// Service worker: centraliza autenticação Supabase, chamadas REST (PostgREST)
// e geração de mensagens com Gemini. O content script só fala com este
// background via chrome.runtime.sendMessage.

importScripts('config.js')

const AUTH_STORAGE_KEY = 'justo_crm_session'

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
  const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CONFIG.SUPABASE_ANON_KEY,
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
  const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CONFIG.SUPABASE_ANON_KEY,
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
  const session = await getValidSession()
  if (!session) throw new Error('not_authenticated')

  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: CONFIG.SUPABASE_ANON_KEY,
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
  // canonPhone = DDD(2) + numero(8). Buscamos por ddd+numero E pelo numero puro
  // (caso o telefone esteja salvo sem DDD ou em formatos variados).
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
  const prompt = `Você é um especialista em prospecção comercial via WhatsApp para uma agência de marketing chamada Justo Mídias.
Escreva UMA mensagem curta (máx. 4 linhas), em português do Brasil, casual e direta, para o primeiro contato com um lead.

Nome do contato: ${nomeContato || 'não informado'}
Empresa: ${nomeEmpresa || 'não informado'}
Contexto adicional: ${contexto || 'nenhum'}

Regras:
- Não use saudações genéricas como "Espero que esteja bem".
- Vá direto ao ponto, gere curiosidade, sem parecer spam.
- Não use emojis em excesso (no máximo 1).
- Retorne APENAS o texto da mensagem, sem aspas, sem explicações.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Erro ao gerar mensagem')

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Resposta vazia da IA')
  return text.trim()
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
