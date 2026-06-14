// Painel lateral injetado no WhatsApp Web.
// Observa a conversa ativa, casa o número com um lead do CRM e permite
// criar/atualizar leads, gerar mensagens de abordagem com IA e iniciar
// conversas a partir da base de leads do CRM.

const STATUS_OPTIONS = [
  { value: 'novo',             label: 'Novo' },
  { value: 'contatado',        label: 'Contatado' },
  { value: 'aguardando',       label: 'Aguardando' },
  { value: 'respondeu',        label: 'Respondeu' },
  { value: 'call_agendada',    label: 'Call agendada' },
  { value: 'call_realizada',   label: 'Call realizada' },
  { value: 'proposta_enviada', label: 'Proposta enviada' },
  { value: 'fechou',           label: 'Fechou' },
  { value: 'perdido',          label: 'Perdido' },
  { value: 'descartado',       label: 'Descartado' },
]

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]))

let currentChat = null // { jid, canonPhone, name }
let currentLead = null
let activeTab = 'chat' // 'chat' | 'leads'
let leadsCache = null
let leadsError = null
let panelEl = null
let bodyEl = null

// ─── UI bootstrap ──────────────────────────────────────────────────────────

function injectPanel() {
  if (document.getElementById('justo-crm-panel')) return

  panelEl = document.createElement('div')
  panelEl.id = 'justo-crm-panel'
  panelEl.innerHTML = `
    <div class="jc-header">
      <div class="jc-logo">Justo <span>CRM</span></div>
      <button class="jc-close" id="jc-close">✕</button>
    </div>
    <div class="jc-tabs">
      <button class="jc-tab active" id="jc-tab-chat">Conversa</button>
      <button class="jc-tab" id="jc-tab-leads">Meus leads</button>
    </div>
    <div class="jc-body" id="jc-body"></div>
  `
  document.body.appendChild(panelEl)

  const toggle = document.createElement('button')
  toggle.id = 'justo-crm-toggle'
  toggle.textContent = 'Justo CRM'
  document.body.appendChild(toggle)

  bodyEl = document.getElementById('jc-body')

  document.getElementById('jc-close').addEventListener('click', () => panelEl.classList.add('collapsed'))
  toggle.addEventListener('click', () => panelEl.classList.toggle('collapsed'))

  document.getElementById('jc-tab-chat').addEventListener('click', () => switchTab('chat'))
  document.getElementById('jc-tab-leads').addEventListener('click', () => switchTab('leads'))

  renderLoading()
  checkAuthThenLoad()
}

function switchTab(tab) {
  if (activeTab === tab) return
  activeTab = tab
  document.getElementById('jc-tab-chat').classList.toggle('active', tab === 'chat')
  document.getElementById('jc-tab-leads').classList.toggle('active', tab === 'leads')
  render()
}

function renderLoading() {
  bodyEl.innerHTML = `<div class="jc-spinner">Carregando...</div>`
}

function renderLoggedOut() {
  bodyEl.innerHTML = `
    <div class="jc-empty">
      Faça login no ícone da extensão (barra do navegador) para usar o painel.
    </div>
  `
}

async function checkAuthThenLoad() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_SESSION' })
  if (!res.ok || !res.data) {
    renderLoggedOut()
    return
  }
  startObserving()
}

// ─── Detecção de chat ativo ──────────────────────────────────────────────

// O WhatsApp Web muda o DOM com frequência e, para contatos com a privacidade
// de número ativada, usa identificadores "@lid" que não trazem o telefone.
// Por isso usamos várias estratégias, da mais para a menos confiável, e
// sempre permitimos ao usuário digitar/corrigir o número manualmente no painel.
function extractActiveChat() {
  const main = document.querySelector('#main')
  if (!main) return null

  const header = main.querySelector('header')
  if (!header) return null

  let jid = null
  let phone = null
  let name = null

  // 1) data-id de mensagens/itens com o formato clássico "...@c.us"
  const msgEl = main.querySelector('[data-id*="@c.us"]')
  if (msgEl) {
    const dataId = msgEl.getAttribute('data-id') || ''
    const match = dataId.match(/(\d{8,15}@c\.us)/)
    if (match) {
      jid = match[1]
      phone = phoneFromJid(jid)
    }
  }

  // 2) Título exibido no cabeçalho da conversa (nome salvo ou o próprio número)
  const titleEl =
    header.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
    header.querySelector('span[dir="auto"][title]') ||
    header.querySelector('span[title]')
  if (titleEl) {
    name = titleEl.getAttribute('title') || titleEl.textContent?.trim() || null
  }

  let canonPhone = phone ? normalizePhone(phone) : null

  // 3) Se não foi possível extrair via JID, e o título exibido parece ser um
  // número de telefone (contato não salvo na agenda), usa ele diretamente.
  if (!canonPhone && name) {
    canonPhone = normalizePhone(name)
  }

  // Chave de identificação do chat para detectar troca de conversa mesmo sem telefone
  const key = jid || canonPhone || name
  if (!key) return null

  return { key, jid, phone, canonPhone, name: name || phone || null }
}

function startObserving() {
  const observer = new MutationObserver(() => {
    const chat = extractActiveChat()
    if (!chat) return
    if (currentChat && currentChat.key === chat.key) return
    currentChat = chat
    onChatChanged(chat)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // checagem inicial
  const chat = extractActiveChat()
  if (chat) {
    currentChat = chat
    onChatChanged(chat)
  } else if (activeTab === 'chat') {
    bodyEl.innerHTML = `<div class="jc-empty">Abra uma conversa no WhatsApp para ver os dados do lead.</div>`
  }
}

// ─── Carregamento do lead ──────────────────────────────────────────────────

async function onChatChanged(chat) {
  currentLead = null
  if (activeTab !== 'chat') return
  if (!chat.canonPhone) {
    render()
    return
  }
  await loadLeadForCurrentChat()
}

async function loadLeadForCurrentChat() {
  if (!currentChat?.canonPhone) {
    currentLead = null
    render()
    return
  }
  renderLoading()
  const res = await chrome.runtime.sendMessage({ type: 'FIND_LEAD', canonPhone: currentChat.canonPhone })
  if (!res.ok) {
    if (res.error === 'not_authenticated') return renderLoggedOut()
    bodyEl.innerHTML = `<div class="jc-empty">Erro ao buscar lead: ${escapeHtml(res.error)}</div>`
    return
  }
  currentLead = res.data
  render()
}

// ─── Render principal ───────────────────────────────────────────────────────

function render() {
  if (activeTab === 'leads') {
    renderLeadsTab()
    return
  }
  renderChatTab()
}

function renderChatTab() {
  if (!currentChat) {
    bodyEl.innerHTML = `<div class="jc-empty">Abra uma conversa no WhatsApp para ver os dados do lead.</div>`
    return
  }

  const phoneDisplay = currentChat.canonPhone ? formatCanonPhone(currentChat.canonPhone) : ''

  let html = `
    <div class="jc-section">
      <div class="jc-contact-name">${escapeHtml(currentChat.name || 'Sem nome')}</div>
      ${phoneDisplay ? `<div class="jc-contact-phone">${escapeHtml(phoneDisplay)}</div>` : ''}
    </div>
  `

  // Quando não conseguimos detectar o telefone automaticamente (comum em
  // contatos com privacidade de número ativada), permite digitar manualmente.
  html += `
    <div class="jc-section">
      <div class="jc-label">Número do contato</div>
      <div class="jc-card">
        ${!currentChat.canonPhone ? `<div style="color:#9CA3AF; margin-bottom: 8px;">Não detectamos o número automaticamente. Digite abaixo para localizar o lead.</div>` : ''}
        <input class="jc-input" id="jc-manual-phone" placeholder="(DDD) 99999-9999" value="${currentChat.canonPhone ? escapeHtml(formatCanonPhone(currentChat.canonPhone)) : ''}" />
        <button class="jc-btn secondary" id="jc-search-phone">Buscar lead</button>
        <div id="jc-phone-msg"></div>
      </div>
    </div>
  `

  if (!currentChat.canonPhone) {
    bodyEl.innerHTML = html
    bindEvents()
    return
  }

  if (currentLead) {
    html += `
      <div class="jc-section">
        <div class="jc-label">Lead no CRM</div>
        <div class="jc-card">
          <div class="jc-row"><span class="k">Empresa</span><span class="v">${escapeHtml(currentLead.nome_fantasia || currentLead.razao_social || '—')}</span></div>
          <div class="jc-row"><span class="k">Vendedor</span><span class="v">${escapeHtml(currentLead.vendedor_nome || '—')}</span></div>
          <select class="jc-select" id="jc-status">
            ${STATUS_OPTIONS.map(s => `<option value="${s.value}" ${s.value === currentLead.status_prospeccao ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
          <button class="jc-btn" id="jc-save-status">Atualizar status</button>
          <div id="jc-status-msg"></div>
        </div>
      </div>
    `
  } else {
    html += `
      <div class="jc-section">
        <div class="jc-label">Lead não encontrado</div>
        <div class="jc-card">
          <div style="color:#9CA3AF; margin-bottom: 8px;">Este número ainda não está no CRM.</div>
          <input class="jc-input" id="jc-new-empresa" placeholder="Nome da empresa / cliente" value="${escapeHtml(currentChat.name || '')}" />
          <button class="jc-btn" id="jc-create-lead">Criar lead</button>
          <div id="jc-create-msg"></div>
        </div>
      </div>
    `
  }

  html += `
    <div class="jc-section">
      <div class="jc-label">Mensagem de abordagem (IA)</div>
      <div class="jc-card">
        <textarea class="jc-textarea" id="jc-contexto" placeholder="Contexto extra (opcional): segmento, dor do cliente, gancho..."></textarea>
        <button class="jc-btn" id="jc-generate">Gerar mensagem</button>
        <div id="jc-gen-result"></div>
      </div>
    </div>
  `

  bodyEl.innerHTML = html
  bindEvents()
}

// ─── Aba "Meus leads" ─────────────────────────────────────────────────────

async function renderLeadsTab(forceReload) {
  if (!leadsCache || forceReload) {
    bodyEl.innerHTML = `<div class="jc-spinner">Carregando leads...</div>`
    const res = await chrome.runtime.sendMessage({ type: 'LIST_LEADS' })
    if (!res.ok) {
      if (res.error === 'not_authenticated') return renderLoggedOut()
      leadsCache = []
      leadsError = res.error
    } else {
      leadsCache = res.data || []
      leadsError = null
    }
    if (activeTab !== 'leads') return
  }

  if (leadsError) {
    bodyEl.innerHTML = `<div class="jc-empty">Erro ao carregar leads: ${escapeHtml(leadsError)}</div>`
    return
  }

  if (leadsCache.length === 0) {
    bodyEl.innerHTML = `<div class="jc-empty">Nenhum lead em prospecção ativa.</div>`
    return
  }

  let html = `
    <div class="jc-section">
      <input class="jc-input" id="jc-leads-search" placeholder="Buscar por nome..." />
    </div>
    <div class="jc-section" id="jc-leads-list"></div>
  `
  bodyEl.innerHTML = html

  const searchEl = document.getElementById('jc-leads-search')
  searchEl.addEventListener('input', () => renderLeadsList(searchEl.value))
  renderLeadsList('')
}

function renderLeadsList(filter) {
  const listEl = document.getElementById('jc-leads-list')
  if (!listEl) return

  const q = (filter || '').trim().toLowerCase()
  const leads = leadsCache.filter(l => {
    if (!q) return true
    const nome = `${l.nome_fantasia || ''} ${l.razao_social || ''}`.toLowerCase()
    return nome.includes(q)
  })

  if (leads.length === 0) {
    listEl.innerHTML = `<div class="jc-empty">Nenhum lead encontrado.</div>`
    return
  }

  listEl.innerHTML = leads.map(l => {
    const canon = normalizePhone(l.telefone)
    const waNumber = canon ? toWhatsappNumber(canon) : null
    return `
      <div class="jc-card jc-lead-item">
        <div class="jc-row"><span class="v">${escapeHtml(l.nome_fantasia || l.razao_social || 'Sem nome')}</span></div>
        <div class="jc-row">
          <span class="k">${escapeHtml(canon ? formatCanonPhone(canon) : (l.telefone || '—'))}</span>
          <span class="jc-badge">${escapeHtml(STATUS_LABEL[l.status_prospeccao] || l.status_prospeccao || '—')}</span>
        </div>
        ${waNumber
          ? `<button class="jc-btn secondary jc-open-chat" data-phone="${waNumber}">Iniciar conversa</button>`
          : `<div class="jc-error">Telefone inválido</div>`}
      </div>
    `
  }).join('')

  listEl.querySelectorAll('.jc-open-chat').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.getAttribute('data-phone')
      window.location.href = `https://web.whatsapp.com/send?phone=${phone}`
    })
  })
}

function bindEvents() {
  const searchPhoneBtn = document.getElementById('jc-search-phone')
  if (searchPhoneBtn) {
    searchPhoneBtn.addEventListener('click', async () => {
      const raw = document.getElementById('jc-manual-phone').value
      const canon = normalizePhone(raw)
      const msgEl = document.getElementById('jc-phone-msg')
      if (!canon) {
        msgEl.innerHTML = `<div class="jc-error">Número inválido. Use o formato (DDD) 99999-9999.</div>`
        return
      }
      currentChat = { ...currentChat, canonPhone: canon }
      await loadLeadForCurrentChat()
    })
  }

  const saveStatusBtn = document.getElementById('jc-save-status')
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', async () => {
      const status = document.getElementById('jc-status').value
      const msgEl = document.getElementById('jc-status-msg')
      saveStatusBtn.disabled = true
      saveStatusBtn.textContent = 'Salvando...'
      const res = await chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', id: currentLead.id, status })
      saveStatusBtn.disabled = false
      saveStatusBtn.textContent = 'Atualizar status'
      if (res.ok) {
        currentLead.status_prospeccao = status
        msgEl.innerHTML = `<div class="jc-success">Status atualizado!</div>`
        leadsCache = null // força recarregar a lista de leads na próxima visita
      } else {
        msgEl.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
      }
    })
  }

  const createBtn = document.getElementById('jc-create-lead')
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const nome = document.getElementById('jc-new-empresa').value.trim()
      const msgEl = document.getElementById('jc-create-msg')
      if (!nome) {
        msgEl.innerHTML = `<div class="jc-error">Informe o nome da empresa/cliente.</div>`
        return
      }
      createBtn.disabled = true
      createBtn.textContent = 'Criando...'
      const payload = {
        razao_social: nome,
        nome_fantasia: nome,
        telefone: formatCanonPhone(currentChat.canonPhone),
        canal_envio: 'whatsapp',
        status_prospeccao: 'contatado',
      }
      const res = await chrome.runtime.sendMessage({ type: 'CREATE_LEAD', payload })
      createBtn.disabled = false
      createBtn.textContent = 'Criar lead'
      if (res.ok) {
        currentLead = res.data
        leadsCache = null
        render()
      } else {
        msgEl.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
      }
    })
  }

  const generateBtn = document.getElementById('jc-generate')
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const contexto = document.getElementById('jc-contexto').value.trim()
      const resultEl = document.getElementById('jc-gen-result')
      generateBtn.disabled = true
      generateBtn.textContent = 'Gerando...'
      resultEl.innerHTML = ''
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_MESSAGE',
        payload: {
          nomeContato: currentChat.name,
          nomeEmpresa: currentLead?.nome_fantasia || currentLead?.razao_social || currentChat.name,
          contexto,
        },
      })
      generateBtn.disabled = false
      generateBtn.textContent = 'Gerar mensagem'
      if (!res.ok) {
        resultEl.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
        return
      }
      resultEl.innerHTML = `
        <div class="jc-msg-box" id="jc-msg-text">${escapeHtml(res.data)}</div>
        <button class="jc-btn secondary" id="jc-insert-msg">Inserir no WhatsApp</button>
      `
      document.getElementById('jc-insert-msg').addEventListener('click', () => insertIntoWhatsApp(res.data))
    })
  }
}

// ─── Inserção de texto no campo de mensagem do WhatsApp ─────────────────────

function insertIntoWhatsApp(text) {
  const box = document.querySelector('#main footer [contenteditable="true"]') || document.querySelector('footer [contenteditable="true"]')
  if (!box) {
    alert('Não foi possível encontrar o campo de mensagem. Clique na conversa e tente novamente.')
    return
  }
  box.focus()

  // WhatsApp Web usa um editor controlado por React; o jeito mais confiável
  // de inserir texto é via execCommand insertText, que dispara os eventos
  // de input esperados pelo editor.
  document.execCommand('insertText', false, text)
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const bootObserver = new MutationObserver(() => {
  if (document.querySelector('#app') && !document.getElementById('justo-crm-panel')) {
    injectPanel()
  }
})
bootObserver.observe(document.body, { childList: true, subtree: true })

if (document.querySelector('#app')) injectPanel()
