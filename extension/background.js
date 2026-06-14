// Service worker: centraliza autenticação Supabase, chamadas REST (PostgREST)
// e geração de mensagens com Gemini. O content script só fala com este
// background via chrome.runtime.sendMessage.

importScripts('config.js')

const AUTH_STORAGE_KEY = 'justo_crm_session'
const CONFIG_STORAGE_KEY = 'justo_crm_config'

// ─── Configuração ───────────────────────────────────────────────────────────

async function getConfig() {
  const data = await chrome.storage.local.get(CONFIG_STORAGE_KEY)
  return { ...DEFAULT_CONFIG, ...(data[CONFIG_STORAGE_KEY] || {}) }
}

async function setConfig(partial) {
  const current = await getConfig()
  const next = { ...current, ...partial }
  await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: next })
  return next
}

// Busca SUPABASE_URL / SUPABASE_ANON_KEY automaticamente a partir do app
// (publicado em <APP_URL>/justo-crm-config.json). Assim o usuário só precisa
// informar a URL do sistema uma vez — nada de copiar/colar chaves.
async function autoDiscoverConfig(appUrl) {
  const base = appUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/justo-crm-config.json`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Não foi possível obter a configuração do sistema. Verifique a URL.')
  const data = await res.json()
  if (!data.SUPABASE_URL || !data.SUPABASE_ANON_KEY) throw new Error('Configuração incompleta no sistema (justo-crm-config.json).')
  return setConfig({ APP_URL: base, SUPABASE_URL: data.SUPABASE_URL, SUPABASE_ANON_KEY: data.SUPABASE_ANON_KEY })
}

function assertConfigured(cfg) {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    throw new Error('not_configured')
  }
}

// ─── Sessão / Autenticação ────────────────────────────────────────────────

async function getSession() {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY)
  return data[AUTH_STORAGE_KEY] || null
}

async function setSession(session) {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session })
}

async function clearSession() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY)
}

async function login(email, password) {
  let cfg = await getConfig()
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    cfg = await autoDiscoverConfig(cfg.APP_URL || DEFAULT_CONFIG.APP_URL)
  }

  const res = await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Falha no login')

  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user,
  }
  await setSession(session)
  return session
}

async function refreshSession(session) {
  const cfg = await getConfig()
  const res = await fetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error('Sessão expirada, faça login novamente')

  const newSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user,
  }
  await setSession(newSession)
  return newSession
}

async function getValidSession() {
  let session = await getSession()
  if (!session) return null
  if (Date.now() > session.expires_at - 60_000) {
    session = await refreshSession(session)
  }
  return session
}

// ─── PostgREST helper ──────────────────────────────────────────────────────

async function pgFetch(path, options = {}) {
  const cfg = await getConfig()
  assertConfigured(cfg)

  const session = await getValidSession()
  if (!session) throw new Error('not_authenticated')

  const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Erro ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// Busca lead pelo telefone canônico (DDD + 8 dígitos), comparando pelos
// últimos 8 dígitos do campo "telefone" via ilike.
async function findLeadByPhone(canonPhone) {
  const last8 = canonPhone.slice(-8)
  const data = await pgFetch(`leads?select=id,razao_social,nome_fantasia,telefone,status_prospeccao,vendedor_id,vendedor_nome&telefone=ilike.*${last8}*&limit=5`)
  return data && data.length ? data[0] : null
}

async function createLead(payload) {
  const data = await pgFetch('leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data[0]
}

async function updateLeadStatus(id, status_prospeccao) {
  await pgFetch(`leads?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status_prospeccao, atualizado_em: new Date().toISOString() }),
    prefer: 'return=minimal',
  })
}

async function insertStatusHistory(empresa_id, status_prospeccao, usuario_id) {
  await pgFetch('status_history', {
    method: 'POST',
    body: JSON.stringify({ empresa_id, status_prospeccao, usuario_id }),
    prefer: 'return=minimal',
  })
}

// ─── Gemini ────────────────────────────────────────────────────────────────

async function generateMessage({ nomeContato, nomeEmpresa, contexto }) {
  const cfg = await getConfig()
  assertConfigured(cfg)

  const session = await getValidSession()
  if (!session) throw new Error('not_authenticated')

  const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/generate-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ nomeContato, nomeEmpresa, contexto }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao gerar mensagem')
  return data.message
}

// ─── Roteamento de mensagens ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'LOGIN':
          return sendResponse({ ok: true, data: await login(msg.email, msg.password) })
        case 'LOGOUT':
          await clearSession()
          return sendResponse({ ok: true })
        case 'GET_SESSION':
          return sendResponse({ ok: true, data: await getValidSession() })
        case 'GET_CONFIG':
          return sendResponse({ ok: true, data: await getConfig() })
        case 'SET_CONFIG':
          return sendResponse({ ok: true, data: await setConfig(msg.config) })
        case 'ENSURE_CONFIG': {
          let cfg = await getConfig()
          if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
            cfg = await autoDiscoverConfig(msg.appUrl || cfg.APP_URL || DEFAULT_CONFIG.APP_URL)
          }
          return sendResponse({ ok: true, data: cfg })
        }
        case 'FIND_LEAD':
          return sendResponse({ ok: true, data: await findLeadByPhone(msg.canonPhone) })
        case 'CREATE_LEAD':
          return sendResponse({ ok: true, data: await createLead(msg.payload) })
        case 'UPDATE_STATUS':
          await updateLeadStatus(msg.id, msg.status)
          const session = await getValidSession()
          await insertStatusHistory(msg.id, msg.status, session?.user?.id)
          return sendResponse({ ok: true })
        case 'GENERATE_MESSAGE':
          return sendResponse({ ok: true, data: await generateMessage(msg.payload) })
        default:
          return sendResponse({ ok: false, error: 'unknown_message_type' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message })
    }
  })()
  return true // resposta assíncrona
})
