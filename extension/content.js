// Painel lateral injetado no WhatsApp Web.
// Observa a conversa ativa, casa o número com um lead do CRM e permite
// criar/atualizar leads e gerar mensagens de abordagem com IA.

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

let currentChat = null // { jid, canonPhone, name }
let currentLead = null
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

  renderLoading()
  checkAuthThenLoad()
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

function extractActiveChat() {
  // O cabeçalho da conversa tem um elemento com a foto de perfil cujo data-id
  // ou os elementos de mensagem trazem o JID no atributo data-id.
  const msgEl = document.querySelector('[data-id*="@c.us"]')
  let jid = null
  if (msgEl) {
    const dataId = msgEl.getAttribute('data-id') || ''
    const match = dataId.match(/(\d{8,15}@c\.us)/)
    if (match) jid = match[1]
  }

  // Nome do contato: cabeçalho da conversa
  const header = document.querySelector('header')
  let name = null
  if (header) {
    const nameEl = header.querySelector('span[dir="auto"][title]')
    if (nameEl) name = nameEl.getAttribute('title') || nameEl.textContent
  }

  if (!jid) return null
  const phone = phoneFromJid(jid)
  const canonPhone = normalizePhone(phone)
  if (!canonPhone) return null

  return { jid, phone, canonPhone, name: name || phone }
}

function startObserving() {
  const observer = new MutationObserver(() => {
    const chat = extractActiveChat()
    if (!chat) return
    if (currentChat && currentChat.jid === chat.jid) return
    currentChat = chat
    onChatChanged(chat)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // checagem inicial
  const chat = extractActiveChat()
  if (chat) {
    currentChat = chat
    onChatChanged(chat)
  } else {
    bodyEl.innerHTML = `<div class="jc-empty">Abra uma conversa no WhatsApp para ver os dados do lead.</div>`
  }
}

// ─── Carregamento do lead ──────────────────────────────────────────────────

async function onChatChanged(chat) {
  renderLoading()
  const res = await chrome.runtime.sendMessage({ type: 'FIND_LEAD', canonPhone: chat.canonPhone })
  if (!res.ok) {
    if (res.error === 'not_authenticated') return renderLoggedOut()
    bodyEl.innerHTML = `<div class="jc-empty">Erro ao buscar lead: ${res.error}</div>`
    return
  }
  currentLead = res.data
  render()
}

// ─── Render principal ───────────────────────────────────────────────────────

function render() {
  if (!currentChat) return

  const phoneDisplay = formatCanonPhone(currentChat.canonPhone)

  let html = `
    <div class="jc-section">
      <div class="jc-contact-name">${escapeHtml(currentChat.name)}</div>
      <div class="jc-contact-phone">${phoneDisplay}</div>
    </div>
  `

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

function bindEvents() {
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
        render()
      } else {
        msgEl.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
      }
    })
  }

  const generateBtn = document.getElementById('jc-generate')
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

// ─── Inserção de texto no campo de mensagem do WhatsApp ─────────────────────

function insertIntoWhatsApp(text) {
  const box = document.querySelector('footer [contenteditable="true"]')
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
