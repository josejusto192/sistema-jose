// Service worker: centraliza autenticação Supabase, chamadas REST (PostgREST)
// e geração de mensagens com Gemini. O content script só fala com este
// background via chrome.runtime.sendMessage.

importScripts('config.js')

const AUTH_STORAGE_KEY = 'justo_crm_session'
const CONFIG_STORAGE_KEY = 'justo_crm_config'

// Campos do lead que o painel usa (mantém o payload enxuto).
const LEAD_FIELDS =
  'id,razao_social,nome_fantasia,nome,sobrenome,tipo,telefone,email,cnpj,' +
  'status_prospeccao,canal_envio,vendedor_id,vendedor_nome,tags,data_followup,' +
  'observacoes,observacoes_json,municipio,uf,bairro,porte,capital_social,' +
  'atividade_principal,criado_em,atualizado_em,data_envio'

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
  return setConfig({
    APP_URL: base,
    SUPABASE_URL: data.SUPABASE_URL,
    SUPABASE_ANON_KEY: data.SUPABASE_ANON_KEY,
    GEMINI_API_KEY: data.GEMINI_API_KEY || '',
    GEMINI_MODEL: data.GEMINI_MODEL || DEFAULT_CONFIG.GEMINI_MODEL,
  })
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

// ─── Leads ─────────────────────────────────────────────────────────────────

// Busca lead pelo telefone canônico (DDD + 8 dígitos), comparando pelos
// últimos 8 dígitos do campo "telefone" via ilike.
async function findLeadByPhone(canonPhone) {
  const last8 = canonPhone.slice(-8)
  const data = await pgFetch(`leads?select=${LEAD_FIELDS}&telefone=ilike.*${last8}*&limit=5`)
  return data && data.length ? data[0] : null
}

async function getLead(id) {
  const data = await pgFetch(`leads?select=${LEAD_FIELDS}&id=eq.${id}&limit=1`)
  return data && data.length ? data[0] : null
}

// Lista leads em prospecção ativa (para iniciar conversas / pipeline).
async function listLeads() {
  return pgFetch(
    `leads?select=${LEAD_FIELDS}` +
    `&status_prospeccao=in.(novo,contatado,aguardando,respondeu,call_agendada,call_realizada,proposta_enviada)` +
    `&order=atualizado_em.desc&limit=300`
  )
}

// Conjunto mínimo para métricas/pipeline (todos os status).
async function metricsLeads() {
  return pgFetch(
    `leads?select=id,nome_fantasia,razao_social,telefone,status_prospeccao,data_followup,atualizado_em,criado_em,vendedor_nome` +
    `&order=atualizado_em.desc&limit=1000`
  )
}

async function createLead(payload) {
  const data = await pgFetch('leads', {
    method: 'POST',
    body: JSON.stringify({ ...payload, atualizado_em: new Date().toISOString() }),
  })
  return data[0]
}

// Update genérico de um lead (status, canal, obs, tags, notas, followup, vendedor...).
async function updateLead(id, patch) {
  const data = await pgFetch(`leads?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...patch, atualizado_em: new Date().toISOString() }),
  })
  return data && data.length ? data[0] : null
}

// Registra a troca de status no histórico (schema migration 003:
// status_anterior / status_novo / usuario_id / usuario_nome).
async function insertStatusHistory({ empresa_id, status_anterior, status_novo, usuario_id, usuario_nome }) {
  try {
    await pgFetch('status_history', {
      method: 'POST',
      body: JSON.stringify({ empresa_id, status_anterior, status_novo, usuario_id, usuario_nome: usuario_nome || 'Extensão' }),
      prefer: 'return=minimal',
    })
  } catch (e) {
    // histórico é best-effort: nunca deve quebrar a troca de status
    console.warn('status_history falhou:', e.message)
  }
}

async function getStatusHistory(empresa_id) {
  return pgFetch(`status_history?select=*&empresa_id=eq.${empresa_id}&order=criado_em.desc&limit=20`)
}

// Scripts/templates cadastrados no sistema (tabela "scripts").
async function listScripts() {
  try {
    return await pgFetch('scripts?select=*&ativo=is.true&order=ordem')
  } catch (e) {
    return [] // o content script tem fallback embutido
  }
}

// Perfis/vendedores (para atribuir dono do lead).
async function listVendedores() {
  try {
    return await pgFetch('profiles?select=id,nome,sobrenome&order=nome')
  } catch (e) {
    return []
  }
}

// ─── Gemini ────────────────────────────────────────────────────────────────

const TOM_INSTRUCOES = {
  consultivo: 'Tom consultivo e profissional, gerando autoridade sem ser arrogante.',
  casual:     'Tom casual, leve e próximo, como uma conversa entre conhecidos.',
  direto:     'Tom direto e objetivo, indo direto ao ponto, sem rodeios.',
  curioso:    'Tom que desperta curiosidade, com um gancho que dá vontade de responder.',
}

async function generateMessage({ nomeContato, nomeEmpresa, contexto, tom, etapa }) {
  let cfg = await getConfig()
  if (!cfg.GEMINI_API_KEY) {
    cfg = await autoDiscoverConfig(cfg.APP_URL || DEFAULT_CONFIG.APP_URL)
  }
  if (!cfg.GEMINI_API_KEY) throw new Error('Chave do Gemini não configurada no sistema.')

  const tomTxt = TOM_INSTRUCOES[tom] || TOM_INSTRUCOES.consultivo
  const etapaTxt = {
    primeiro:  'Este é o PRIMEIRO contato com o lead.',
    followup:  'Este é um FOLLOW-UP — o lead não respondeu ao primeiro contato. Seja gentil e reforce o valor sem cobrar.',
    proposta:  'O lead demonstrou interesse — conduza para uma call ou apresente a proposta.',
  }[etapa] || 'Este é o primeiro contato com o lead.'

  const prompt = `Você é um especialista em prospecção comercial via WhatsApp para a agência de marketing Justo Mídias (criação de sites e gestão de tráfego/Meta Ads).
Escreva UMA mensagem curta (máx. 4 linhas), em português do Brasil, para WhatsApp.

${etapaTxt}
${tomTxt}

Nome do contato: ${nomeContato || 'não informado'}
Empresa: ${nomeEmpresa || 'não informado'}
Contexto adicional: ${contexto || 'nenhum'}

Regras:
- Não use saudações genéricas como "Espero que esteja bem".
- Vá direto ao ponto, gere curiosidade, sem parecer spam.
- No máximo 1 emoji.
- Retorne APENAS o texto da mensagem, sem aspas, sem explicações.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.GEMINI_MODEL}:generateContent?key=${cfg.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 220 },
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const apiMsg = data.error?.message || ''
    if (res.status === 429 || /quota|rate.?limit|exceed/i.test(apiMsg)) {
      throw new Error(`Cota da API do Gemini esgotada (modelo ${cfg.GEMINI_MODEL}). Verifique a chave e o faturamento no Google AI Studio, ou troque o modelo nas configurações.`)
    }
    throw new Error(apiMsg || 'Erro ao gerar mensagem')
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Resposta vazia da IA')
  return text
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
        case 'GET_LEAD':
          return sendResponse({ ok: true, data: await getLead(msg.id) })
        case 'LIST_LEADS':
          return sendResponse({ ok: true, data: await listLeads() })
        case 'METRICS_LEADS':
          return sendResponse({ ok: true, data: await metricsLeads() })
        case 'CREATE_LEAD':
          return sendResponse({ ok: true, data: await createLead(msg.payload) })
        case 'UPDATE_LEAD':
          return sendResponse({ ok: true, data: await updateLead(msg.id, msg.patch) })
        case 'UPDATE_STATUS': {
          const updated = await updateLead(msg.id, { status_prospeccao: msg.status })
          const session = await getValidSession()
          const nome = session?.user?.user_metadata?.nome || session?.user?.email || 'Extensão'
          await insertStatusHistory({
            empresa_id: msg.id,
            status_anterior: msg.prevStatus || null,
            status_novo: msg.status,
            usuario_id: session?.user?.id || null,
            usuario_nome: nome,
          })
          return sendResponse({ ok: true, data: updated })
        }
        case 'STATUS_HISTORY':
          return sendResponse({ ok: true, data: await getStatusHistory(msg.id) })
        case 'LIST_SCRIPTS':
          return sendResponse({ ok: true, data: await listScripts() })
        case 'LIST_VENDEDORES':
          return sendResponse({ ok: true, data: await listVendedores() })
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
