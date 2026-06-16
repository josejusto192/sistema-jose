// ════════════════════════════════════════════════════════════════════
// Justo CRM — painel profissional injetado no WhatsApp Web
// Abas: Lead (CRM rico) · Pipeline (métricas/funil) · IA (geração + templates)
// · Leads (lista/busca). Interação robusta com o WhatsApp Web.
// Toda a comunicação com Supabase/Gemini passa por background.js.
// ════════════════════════════════════════════════════════════════════

// ─── Config de status (espelha src/constants.js, variantes dark) ────────────
const STATUS_CONFIG = {
  novo:             { label: 'Novo',             dot: '#3B82F6', color: '#60A5FA', bg: '#1E3A5F' },
  contatado:        { label: 'Contatado',        dot: '#F59E0B', color: '#FCD34D', bg: '#2D1F00' },
  aguardando:       { label: 'Aguardando',       dot: '#8B5CF6', color: '#A78BFA', bg: '#1E1040' },
  respondeu:        { label: 'Respondeu',        dot: '#06B6D4', color: '#22D3EE', bg: '#062028' },
  call_agendada:    { label: 'Call agendada',    dot: '#10B981', color: '#34D399', bg: '#052E16' },
  call_realizada:   { label: 'Call realizada',   dot: '#10B981', color: '#6EE7B7', bg: '#052E16' },
  proposta_enviada: { label: 'Proposta enviada', dot: '#F59E0B', color: '#FCD34D', bg: '#2D1A00' },
  fechou:           { label: 'Fechou',           dot: '#10B981', color: '#34D399', bg: '#052E16' },
  perdido:          { label: 'Perdido',          dot: '#EF4444', color: '#F87171', bg: '#2D0A0A' },
  descartado:       { label: 'Descartado',       dot: '#9CA3AF', color: '#6B7280', bg: '#1F2937' },
}
const STATUS_ORDER = Object.keys(STATUS_CONFIG)
const FUNNEL_ORDER = ['novo', 'contatado', 'aguardando', 'respondeu', 'call_agendada', 'call_realizada', 'proposta_enviada', 'fechou']

// ─── Templates (fallback embutido; se houver tabela "scripts", ela prevalece) ──
const FALLBACK_TEMPLATES = [
  { id: 'wp_sem_site', titulo: 'Prospecção inicial', etapa: 'primeiro',
    texto: `Oi, [Nome]! Tudo bem? 👋\n\nSou o José, trabalho com criação de sites e gestão de anúncios para empresas.\n\nVi que vocês ainda não têm uma página própria na internet — isso faz perder clientes que pesquisam online antes de fechar negócio.\n\nTenho uma ideia pra [Empresa], posso mostrar em 15 minutos? 🤝` },
  { id: 'wp_followup1', titulo: 'Follow-up (3 dias)', etapa: 'followup',
    texto: `Oi [Nome], tudo bem? 😊\n\nSó passando pra ver se viu minha mensagem anterior.\n\nSe quiser, posso mandar uma prévia do que pensei pra [Empresa] direto aqui no WhatsApp, sem precisar de call 👀` },
  { id: 'wp_followup2', titulo: 'Follow-up final (7 dias)', etapa: 'followup',
    texto: `Oi [Nome]! Última tentativa — sei que é corrido por aí 😅\n\nSe um dia tiver interesse em melhorar a captação de clientes online, é só me chamar. Fico à disposição!\n\nUm abraço 🤝` },
  { id: 'proposta_ed', titulo: 'Proposta — Estrutura Digital', etapa: 'proposta',
    texto: `[Nome], preparei a proposta pra [Empresa]! 🎯\n\n📌 *Pacote Estrutura Digital — R$ 1.997*\n✅ Landing Page profissional (WordPress)\n✅ Configuração completa Meta Ads\n✅ Criativos para os anúncios\n✅ Entrega em 5 dias úteis\n✅ 30 dias de suporte incluído\n\n💳 Pagamento: 50% na assinatura + 50% na entrega\n\nTopam uma call rápida de 20 min pra eu apresentar? 🤝` },
  { id: 'proposta_gt', titulo: 'Proposta — Gestão de Tráfego', etapa: 'proposta',
    texto: `[Nome], segue minha proposta para gestão dos anúncios de [Empresa]! 🚀\n\n📌 *Gestão de Tráfego Mensal — R$ 997/mês*\n✅ Gestão de até 2 campanhas no Meta Ads\n✅ Otimização semanal\n✅ Criativos para os anúncios\n✅ Relatório mensal detalhado\n✅ Reunião mensal de resultado\n\n📋 Fidelidade mínima: 3 meses\n\nVamos marcar uma call? 🤝` },
]

// ─── SVG icons ──────────────────────────────────────────────────────────────
const IC = {
  lead:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  pipeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  ia:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5 10.1 10.9 5.5 9l4.6-1.4L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></svg>',
  leads:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  search:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  empty:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
}

// ─── Estado ──────────────────────────────────────────────────────────────────
let currentChat = null   // { key, jid, phone, canonPhone, name }
let currentLead = null
let activeTab = 'lead'    // 'lead' | 'pipeline' | 'ia' | 'leads' | 'disparar'
let config = null
let leadsCache = null
let metricsCache = null
let scriptsCache = null
let iaState = { etapa: 'primeiro', tom: 'consultivo', result: null }
let disparoState = { step: 1, selected: new Set(), template: '', delay: 30, running: false, idx: 0, log: [] }
let chatLeadMap = {}  // nome-chat-em-lower | canonPhone → lead (populado conforme o usuário abre chats)
let panelEl = null, bodyEl = null

// ─── Wrapper de mensagens p/ o background ────────────────────────────────────
function api(type, extra = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, ...extra }, resolve)
  })
}

// ════════════════════════════════════════════════════════════════════════════
// Bootstrap do painel
// ════════════════════════════════════════════════════════════════════════════
function injectPanel() {
  if (document.getElementById('justo-crm-panel')) return

  panelEl = document.createElement('div')
  panelEl.id = 'justo-crm-panel'
  panelEl.innerHTML = `
    <div class="jc-header">
      <div class="jc-logo"><span class="jc-mark">J</span>Justo <span>CRM</span></div>
      <div class="jc-header-actions">
        <button class="jc-icon-btn" id="jc-refresh" title="Atualizar">↻</button>
        <button class="jc-icon-btn" id="jc-collapse" title="Recolher">✕</button>
      </div>
    </div>
    <div class="jc-tabs">
      <button class="jc-tab active" data-tab="lead">${IC.lead}Lead</button>
      <button class="jc-tab" data-tab="pipeline">${IC.pipeline}Kanban</button>
      <button class="jc-tab" data-tab="ia">${IC.ia}IA</button>
      <button class="jc-tab" data-tab="leads">${IC.leads}Leads</button>
      <button class="jc-tab" data-tab="disparar">🚀</button>
    </div>
    <div class="jc-body" id="jc-body"></div>
  `
  document.body.appendChild(panelEl)
  document.body.classList.add('jc-panel-open')

  const toggle = document.createElement('button')
  toggle.id = 'justo-crm-toggle'
  toggle.textContent = 'Justo CRM'
  toggle.style.display = 'none'
  document.body.appendChild(toggle)

  bodyEl = panelEl.querySelector('#jc-body')

  panelEl.querySelector('#jc-collapse').addEventListener('click', () => {
    panelEl.classList.add('collapsed')
    document.body.classList.remove('jc-panel-open')
    toggle.style.display = 'inline-flex'
  })
  toggle.addEventListener('click', () => {
    panelEl.classList.remove('collapsed')
    document.body.classList.add('jc-panel-open')
    toggle.style.display = 'none'
  })
  panelEl.querySelector('#jc-refresh').addEventListener('click', () => {
    leadsCache = null; metricsCache = null; scriptsCache = null
    if (currentChat?.canonPhone) loadLeadForCurrentChat(); else render()
  })
  panelEl.querySelectorAll('.jc-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })

  renderLoading()
  checkAuthThenLoad()
}

function switchTab(tab) {
  if (activeTab === tab) return
  activeTab = tab
  panelEl.querySelectorAll('.jc-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  render()
}

// Injeta badge de status do CRM nos itens da lista de conversas do WhatsApp.
// Opera apenas nos chats que o usuário já abriu (chatLeadMap é preenchido on-demand).
function injectChatListBadges() {
  document.querySelectorAll('[data-testid^="list-item-"]').forEach(item => {
    if (item.dataset.jcBadged === '1') return
    const titleEl = item.querySelector('[data-testid="cell-frame-title"]')
    if (!titleEl) return

    const text = titleEl.textContent.trim()
    let lead = chatLeadMap[text.toLowerCase()]
    if (!lead) {
      const canon = normalizePhone(text)
      if (canon) lead = chatLeadMap[canon]
    }
    if (!lead) return

    const cfg = STATUS_CONFIG[lead.status_prospeccao] || STATUS_CONFIG.novo
    const badge = document.createElement('span')
    badge.className = 'jc-list-badge'
    badge.textContent = cfg.label
    badge.style.cssText = `background:${cfg.bg};color:${cfg.color};`
    titleEl.style.cssText += 'display:flex;align-items:center;gap:4px;'
    titleEl.appendChild(badge)
    item.dataset.jcBadged = '1'
  })
}

function startChatListBadgeObserver() {
  let t = null
  const obs = new MutationObserver(() => {
    clearTimeout(t)
    t = setTimeout(injectChatListBadges, 400)
  })
  const chatList = document.querySelector('[data-testid="chat-list"]')
  if (chatList) obs.observe(chatList, { childList: true, subtree: true })
  // Also watch for the chat list to appear if not yet rendered
  else {
    const bodyObs = new MutationObserver(() => {
      const cl = document.querySelector('[data-testid="chat-list"]')
      if (cl) { bodyObs.disconnect(); obs.observe(cl, { childList: true, subtree: true }) }
    })
    bodyObs.observe(document.body, { childList: true, subtree: true })
  }
}

async function checkAuthThenLoad() {
  const res = await api('GET_SESSION')
  if (!res || !res.ok || !res.data) { renderLoggedOut(); return }
  const cfgRes = await api('GET_CONFIG')
  config = cfgRes?.data || null
  startObserving()
  startChatListBadgeObserver()
  render()
}

// ════════════════════════════════════════════════════════════════════════════
// Detecção do chat ativo (robusta — sem depender do data-id @c.us, já extinto)
// ════════════════════════════════════════════════════════════════════════════
function readChatTitle(header) {
  const testid = header.querySelector('[data-testid="conversation-info-header-chat-title"]')
  if (testid && testid.textContent.trim()) return testid.textContent.trim()
  const titled = header.querySelector('span[dir="auto"][title]') || header.querySelector('span[title]')
  if (titled) {
    const v = (titled.getAttribute('title') || titled.textContent || '').trim()
    if (v) return v
  }
  const span = header.querySelector('span[dir="auto"]')
  return span && span.textContent.trim() ? span.textContent.trim() : null
}

function phoneFromText(text) {
  if (!text) return null
  const digits = String(text).replace(/\D/g, '')
  if (digits.length < 10) return null
  return normalizePhone(digits)
}

function extractActiveChat() {
  const main = document.querySelector('#main')
  if (!main) return null
  const header = main.querySelector('header')
  if (!header) return null

  let jid = null, phone = null
  const msgEl = main.querySelector('[data-id*="@c.us"]')
  if (msgEl) {
    const m = (msgEl.getAttribute('data-id') || '').match(/(\d{8,15})@c\.us/)
    if (m) { jid = m[1] + '@c.us'; phone = m[1] }
  }

  const title = readChatTitle(header)
  const box = main.querySelector('[data-testid="conversation-compose-box-input"]')
    || main.querySelector('footer [contenteditable="true"]')
  const inputAria = box ? (box.getAttribute('aria-label') || '') : ''

  const canonPhone =
    (phone ? normalizePhone(phone) : null) ||
    phoneFromText(inputAria) ||
    phoneFromText(title)

  const name = title || phone || null
  const key = jid || canonPhone || name
  if (!key) return null
  return { key, jid, phone, canonPhone, name }
}

function startObserving() {
  let debounce = null
  let titleObs = null

  function checkChat() {
    const chat = extractActiveChat()
    if (!chat) return
    if (currentChat && currentChat.key === chat.key) return
    currentChat = chat
    onChatChanged(chat)
  }

  // Quando o título da conversa aparece no DOM, trocamos o observer largo
  // pelo observer cirúrgico que escuta apenas mudanças nesse elemento.
  function tryAttachTitleObserver() {
    if (titleObs) return
    const titleEl = document.querySelector('[data-testid="conversation-info-header-chat-title"]')
    if (!titleEl) return
    titleObs = new MutationObserver(() => {
      clearTimeout(debounce)
      debounce = setTimeout(checkChat, 150)
    })
    titleObs.observe(titleEl.closest('[data-testid="conversation-header"]') || titleEl, {
      childList: true, subtree: true, characterData: true,
    })
  }

  // Observer largo com debounce — usado até o título aparecer no DOM.
  const broadObs = new MutationObserver(() => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      tryAttachTitleObserver()
      checkChat()
    }, 250)
  })
  broadObs.observe(document.body, { childList: true, subtree: true })

  const chat = extractActiveChat()
  if (chat) { currentChat = chat; onChatChanged(chat) }
  tryAttachTitleObserver()
}

async function onChatChanged(chat) {
  currentLead = null
  iaState.result = null
  if (activeTab !== 'lead') { if (activeTab === 'ia') render(); return }
  if (!chat.canonPhone) { render(); return }
  await loadLeadForCurrentChat()
}

async function loadLeadForCurrentChat() {
  if (!currentChat?.canonPhone) { currentLead = null; render(); return }
  if (activeTab === 'lead') renderLoading()
  const res = await api('FIND_LEAD', { canonPhone: currentChat.canonPhone })
  if (!res.ok) {
    if (res.error === 'not_authenticated') return renderLoggedOut()
    if (activeTab === 'lead') bodyEl.innerHTML = `<div class="jc-error">Erro ao buscar lead: ${escapeHtml(res.error)}</div>`
    return
  }
  currentLead = res.data
  if (currentLead && currentChat) {
    if (currentChat.canonPhone) chatLeadMap[currentChat.canonPhone] = currentLead
    if (currentChat.name) chatLeadMap[currentChat.name.toLowerCase()] = currentLead
    injectChatListBadges()
  }
  if (activeTab === 'lead' || activeTab === 'ia') render()
}

// ════════════════════════════════════════════════════════════════════════════
// Render principal
// ════════════════════════════════════════════════════════════════════════════
function render() {
  if (!bodyEl) return
  if (activeTab === 'pipeline') return renderPipeline()
  if (activeTab === 'ia') return renderIA()
  if (activeTab === 'leads') return renderLeadsTab()
  if (activeTab === 'disparar') return renderDisparo()
  return renderLeadTab()
}

function renderLoading() { bodyEl.innerHTML = `<div class="jc-spinner">Carregando…</div>` }
function renderLoggedOut() {
  bodyEl.innerHTML = `<div class="jc-empty">${IC.lead}<div>Faça login pelo ícone da extensão (na barra do navegador) para usar o painel.</div></div>`
}

// ─── Aba LEAD ────────────────────────────────────────────────────────────────
function contactHeaderHTML() {
  const name = currentChat?.name || 'Sem nome'
  const phoneDisplay = currentChat?.canonPhone ? formatCanonPhone(currentChat.canonPhone) : ''
  return `
    <div class="jc-contact">
      <div class="jc-avatar">${escapeHtml(initials(name))}</div>
      <div>
        <div class="jc-contact-name">${escapeHtml(name)}</div>
        ${phoneDisplay ? `<div class="jc-contact-phone">${escapeHtml(phoneDisplay)}</div>` : ''}
      </div>
    </div>`
}

function renderLeadTab() {
  if (!currentChat) {
    bodyEl.innerHTML = `<div class="jc-empty">${IC.empty}<div>Abra uma conversa no WhatsApp para ver e gerenciar o lead.</div></div>`
    return
  }

  let html = contactHeaderHTML()

  if (!currentChat.canonPhone) {
    html += `
      <div class="jc-section">
        <div class="jc-label">Número não detectado</div>
        <div class="jc-card">
          <div class="jc-hint">Contato salvo na agenda? O WhatsApp não expõe o número. Digite abaixo para localizar o lead.</div>
          <input class="jc-input" id="jc-manual-phone" placeholder="(DDD) 99999-9999" />
          <button class="jc-btn" id="jc-search-phone">Buscar lead</button>
          <div id="jc-phone-msg"></div>
        </div>
      </div>`
    bodyEl.innerHTML = html
    bindLeadEvents()
    return
  }

  if (currentLead) {
    html += renderLeadCRM(currentLead)
  } else {
    html += `
      <div class="jc-section">
        <div class="jc-label">Lead não está no CRM</div>
        <div class="jc-card">
          <div class="jc-hint">Este número ainda não está cadastrado. Crie o lead para começar a prospecção.</div>
          <input class="jc-input" id="jc-new-empresa" placeholder="Nome da empresa / cliente" value="${escapeHtml(currentChat.name || '')}" />
          <button class="jc-btn" id="jc-create-lead">+ Criar lead</button>
          <div id="jc-create-msg"></div>
        </div>
      </div>`
  }

  bodyEl.innerHTML = html
  bindLeadEvents()
}

// Lê as últimas mensagens da conversa aberta diretamente do DOM do WhatsApp.
function getRecentMessages(limit = 8) {
  const panel = document.querySelector('[data-testid="conversation-panel-messages"]')
  if (!panel) return []
  const all = [...panel.querySelectorAll('[data-testid^="conv-msg-"]')]
  return all.slice(-limit).map(msg => ({
    text: msg.querySelector('[data-testid="selectable-text"]')?.textContent?.trim() || '',
    time: (msg.querySelector('[data-testid="msg-meta"]')?.textContent || '').replace(/[^\d:apm]/gi, '').trim(),
    sent: !!msg.querySelector('[data-testid="tail-out"]'),
  })).filter(m => m.text)
}

// Renderiza uma linha "chave: valor" apenas se o valor existir (evita poluir
// o painel com campos vazios, já que muitos leads não têm todos os dados).
function dataRow(label, value, opts = {}) {
  if (value == null || value === '') return ''
  const v = opts.html ? value : escapeHtml(String(value))
  const style = opts.maxWidth ? ` style="max-width:${opts.maxWidth}px;text-align:right"` : ''
  return `<div class="jc-row"><span class="k">${escapeHtml(label)}</span><span class="v"${style}>${v}</span></div>`
}

function formatCnpj(cnpj) {
  const d = String(cnpj || '').replace(/\D/g, '')
  if (d.length !== 14) return cnpj || ''
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function formatFullDate(d) {
  if (!d) return ''
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function renderLeadCRM(lead) {
  const cfg = STATUS_CONFIG[lead.status_prospeccao] || STATUS_CONFIG.novo
  const empresa = lead.nome_fantasia || lead.razao_social || '—'
  const local = [lead.municipio, lead.uf].filter(Boolean).join(' / ')
  const notas = parseNotas(lead.observacoes_json)
  const tags = lead.tags || []
  const followup = lead.data_followup || ''

  const msgs = getRecentMessages(8)
  const leadReplied = msgs.length > 0 && !msgs[msgs.length - 1].sent
  const showReplyBanner = leadReplied && !['respondeu', 'call_agendada', 'call_realizada', 'proposta_enviada', 'fechou'].includes(lead.status_prospeccao)

  let h = `
    ${showReplyBanner ? `
    <div class="jc-reply-banner" id="jc-reply-banner">
      <div>💬 <b>${escapeHtml(empresa)}</b> respondeu! Atualizar status para <b>Respondeu</b>?</div>
      <div class="jc-btn-row" style="margin-top:6px">
        <button class="jc-btn jc-btn-sm" id="jc-mark-respondeu">Sim, atualizar</button>
        <button class="jc-btn ghost jc-btn-sm" id="jc-dismiss-banner">Ignorar</button>
      </div>
    </div>` : ''}

    <div class="jc-section">
      <div class="jc-row" style="margin-bottom:8px">
        <span class="jc-badge" style="background:${cfg.bg};color:${cfg.color}"><span class="dot" style="background:${cfg.dot}"></span>${cfg.label}</span>
        ${lead.vendedor_nome ? `<span class="jc-row v" style="font-size:11px;color:var(--jc-text3)">${escapeHtml(lead.vendedor_nome)}</span>` : ''}
      </div>
      <div class="jc-card">
        <div class="jc-row"><span class="k">Empresa</span><span class="v">${escapeHtml(empresa)}</span></div>
        ${lead.razao_social && lead.razao_social !== empresa ? dataRow('Razão social', lead.razao_social, { maxWidth: 200 }) : ''}
        ${local ? `<div class="jc-row"><span class="k">Local</span><span class="v">${escapeHtml(local)}</span></div>` : ''}
        ${lead.porte_descricao ? `<div class="jc-row"><span class="k">Porte</span><span class="v">${escapeHtml(lead.porte_descricao)}</span></div>` : ''}
        ${lead.cnae_principal_descricao ? `<div class="jc-row"><span class="k">Atividade</span><span class="v" style="max-width:200px">${escapeHtml(lead.cnae_principal_descricao)}</span></div>` : ''}
      </div>
    </div>

    <div class="jc-section">
      <div class="jc-label">Dados completos</div>
      <div class="jc-card">
        ${dataRow('CNPJ', formatCnpj(lead.cnpj), { maxWidth: 160 })}
        ${dataRow('Natureza jurídica', lead.natureza_juridica_descricao, { maxWidth: 200 })}
        ${dataRow('Data de abertura', formatFullDate(lead.data_abertura))}
        ${dataRow('Situação cadastral', lead.situacao_cadastral)}
        ${dataRow('Capital social', lead.capital_social ? `R$ ${Number(lead.capital_social).toLocaleString('pt-BR')}` : null)}
        ${dataRow('E-mail', lead.email, { maxWidth: 200 })}
        ${dataRow('E-mail válido', lead.email_valido != null ? (lead.email_valido ? 'Sim' : 'Não') : null)}
        ${dataRow('Telefone', lead.telefone, { maxWidth: 160 })}
        ${dataRow('DDD / Tipo', lead.telefone_ddd ? `${lead.telefone_ddd} · ${lead.telefone_tipo || ''}` : null)}
      </div>
    </div>

    ${lead.cnae_principal_descricao || lead.cnaes_secundarios?.length ? `
    <div class="jc-section">
      <div class="jc-label">Atividade econômica</div>
      <div class="jc-card">
        ${dataRow('CNAE principal', lead.cnae_principal_descricao ? `${lead.cnae_principal_codigo ? lead.cnae_principal_codigo + ' — ' : ''}${lead.cnae_principal_descricao}` : null, { maxWidth: 200 })}
        ${lead.cnaes_secundarios?.length ? `
          <div class="jc-hint" style="margin-top:6px;margin-bottom:4px">CNAEs secundários</div>
          ${lead.cnaes_secundarios.slice(0, 8).map(c => `
            <div class="jc-row"><span class="k" style="font-family:monospace">${escapeHtml(c.codigo || '')}</span><span class="v" style="max-width:200px">${escapeHtml(c.descricao || '')}</span></div>
          `).join('')}
        ` : ''}
      </div>
    </div>` : ''}

    ${(lead.logradouro || lead.bairro || lead.cep) ? `
    <div class="jc-section">
      <div class="jc-label">Endereço</div>
      <div class="jc-card">
        ${dataRow('Logradouro', [lead.tipo_logradouro, lead.logradouro, lead.numero].filter(Boolean).join(' '), { maxWidth: 200 })}
        ${dataRow('Complemento', lead.complemento, { maxWidth: 200 })}
        ${dataRow('Bairro', lead.bairro)}
        ${dataRow('Município/UF', local)}
        ${dataRow('CEP', lead.cep)}
      </div>
    </div>` : ''}

    ${(lead.instagram_url || lead.linkedin_url || lead.facebook_url || lead.site_url) ? `
    <div class="jc-section">
      <div class="jc-label">Redes / site</div>
      <div class="jc-card">
        ${lead.site_url ? dataRow('Site', `<a href="${escapeHtml(lead.site_url)}" target="_blank" rel="noopener">${escapeHtml(lead.site_url)}</a>`, { html: true, maxWidth: 200 }) : ''}
        ${lead.instagram_url ? dataRow('Instagram', `<a href="${escapeHtml(lead.instagram_url)}" target="_blank" rel="noopener">abrir</a>`, { html: true }) : ''}
        ${lead.linkedin_url ? dataRow('LinkedIn', `<a href="${escapeHtml(lead.linkedin_url)}" target="_blank" rel="noopener">abrir</a>`, { html: true }) : ''}
        ${lead.facebook_url ? dataRow('Facebook', `<a href="${escapeHtml(lead.facebook_url)}" target="_blank" rel="noopener">abrir</a>`, { html: true }) : ''}
      </div>
    </div>` : ''}

    ${lead.quadro_societario?.length ? `
    <div class="jc-section">
      <div class="jc-label">Quadro societário (${lead.quadro_societario.length})</div>
      <div class="jc-card">
        ${lead.quadro_societario.map(s => `
          <div class="jc-row"><span class="k">${escapeHtml(s.nome || '')}</span><span class="v" style="max-width:200px">${escapeHtml([s.qualificacao_socio, s.faixa_etaria_descricao].filter(Boolean).join(' · '))}</span></div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="jc-section">
      <div class="jc-label">Status da prospecção</div>
      <select class="jc-select" id="jc-status">
        ${STATUS_ORDER.map(s => `<option value="${s}" ${s === lead.status_prospeccao ? 'selected' : ''}>${STATUS_CONFIG[s].label}</option>`).join('')}
      </select>
      <div id="jc-status-msg"></div>
    </div>

    <div class="jc-section">
      <div class="jc-label">Próximo follow-up</div>
      <input type="date" class="jc-input" id="jc-followup" value="${escapeHtml(followup)}" />
      <div id="jc-followup-msg"></div>
    </div>

    <div class="jc-section">
      <div class="jc-label">Tags</div>
      <div class="jc-tags" id="jc-tags">
        ${tags.map(t => `<span class="jc-chip">${escapeHtml(t)}<button data-tag="${escapeHtml(t)}">×</button></span>`).join('') || '<span class="jc-hint">Sem tags</span>'}
      </div>
      <input class="jc-input" id="jc-tag-input" placeholder="Adicionar tag e Enter" />
    </div>

    <div class="jc-section">
      <div class="jc-label">Notas</div>
      <textarea class="jc-textarea" id="jc-nota" placeholder="Anotar uma observação sobre o lead…"></textarea>
      <button class="jc-btn secondary" id="jc-add-nota">+ Adicionar nota</button>
      <div class="jc-notes" id="jc-notes-list">
        ${notas.length ? notas.slice().reverse().map(n => `
          <div class="jc-note"><div class="txt">${escapeHtml(n.texto)}</div><div class="meta">${formatDateTime(n.data)}</div></div>
        `).join('') : '<div class="jc-hint" style="margin-top:8px">Nenhuma nota ainda.</div>'}
      </div>
    </div>

    ${msgs.length ? `
    <div class="jc-section">
      <div class="jc-label">Conversa recente</div>
      <div class="jc-messages">
        ${msgs.map(m => `
          <div class="jc-msg ${m.sent ? 'sent' : 'recv'}">
            <div class="jc-msg-bubble">${escapeHtml(m.text)}</div>
            ${m.time ? `<div class="jc-msg-time">${escapeHtml(m.time)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="jc-section jc-btn-row">
      <button class="jc-btn ghost" id="jc-goto-ia">✨ Gerar mensagem</button>
      ${config?.APP_URL ? `<button class="jc-btn secondary" id="jc-open-system">Abrir no sistema</button>` : ''}
    </div>
  `
  return h
}

function bindLeadEvents() {
  const $ = id => document.getElementById(id)

  $('jc-search-phone')?.addEventListener('click', async () => {
    const canon = normalizePhone($('jc-manual-phone').value)
    const msg = $('jc-phone-msg')
    if (!canon) { msg.innerHTML = `<div class="jc-error">Número inválido. Use (DDD) 99999-9999.</div>`; return }
    currentChat = { ...currentChat, canonPhone: canon }
    await loadLeadForCurrentChat()
  })

  $('jc-create-lead')?.addEventListener('click', async () => {
    const nome = $('jc-new-empresa').value.trim()
    const msg = $('jc-create-msg')
    if (!nome) { msg.innerHTML = `<div class="jc-error">Informe o nome da empresa/cliente.</div>`; return }
    const btn = $('jc-create-lead'); btn.disabled = true; btn.textContent = 'Criando…'
    const res = await api('CREATE_LEAD', { payload: {
      razao_social: nome, nome_fantasia: nome,
      telefone: formatCanonPhone(currentChat.canonPhone),
      canal_envio: 'whatsapp', status_prospeccao: 'novo',
    }})
    btn.disabled = false; btn.textContent = '+ Criar lead'
    if (res.ok) { currentLead = res.data; leadsCache = null; metricsCache = null; render() }
    else msg.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
  })

  $('jc-status')?.addEventListener('change', async (e) => {
    const status = e.target.value
    const prev = currentLead.status_prospeccao
    const msg = $('jc-status-msg')
    const res = await api('UPDATE_STATUS', { id: currentLead.id, status, prevStatus: prev })
    if (res.ok) {
      currentLead.status_prospeccao = status; leadsCache = null; metricsCache = null
      msg.innerHTML = `<div class="jc-success">${IC.check} Status atualizado</div>`
      setTimeout(() => render(), 600)
    } else msg.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
  })

  $('jc-followup')?.addEventListener('change', async (e) => {
    const res = await api('UPDATE_LEAD', { id: currentLead.id, patch: { data_followup: e.target.value || null } })
    const msg = $('jc-followup-msg')
    if (res.ok) { currentLead.data_followup = e.target.value; metricsCache = null; msg.innerHTML = `<div class="jc-success">${IC.check} Follow-up salvo</div>` }
    else msg.innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`
  })

  $('jc-tag-input')?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = e.target.value.trim()
    if (!t) return
    const tags = [...(currentLead.tags || [])]
    if (tags.includes(t)) { e.target.value = ''; return }
    tags.push(t)
    const res = await api('UPDATE_LEAD', { id: currentLead.id, patch: { tags } })
    if (res.ok) { currentLead.tags = tags; render() }
  })

  document.querySelectorAll('#jc-tags .jc-chip button').forEach(b => {
    b.addEventListener('click', async () => {
      const tags = (currentLead.tags || []).filter(t => t !== b.dataset.tag)
      const res = await api('UPDATE_LEAD', { id: currentLead.id, patch: { tags } })
      if (res.ok) { currentLead.tags = tags; render() }
    })
  })

  $('jc-add-nota')?.addEventListener('click', async () => {
    const texto = $('jc-nota').value.trim()
    if (!texto) return
    const notas = parseNotas(currentLead.observacoes_json)
    notas.push({ texto, data: new Date().toISOString() })
    const res = await api('UPDATE_LEAD', { id: currentLead.id, patch: { observacoes_json: JSON.stringify(notas) } })
    if (res.ok) { currentLead.observacoes_json = JSON.stringify(notas); render() }
  })

  $('jc-goto-ia')?.addEventListener('click', () => switchTab('ia'))
  $('jc-open-system')?.addEventListener('click', () => {
    window.open(`${config.APP_URL.replace(/\/+$/, '')}/?lead=${currentLead.id}`, '_blank')
  })

  $('jc-mark-respondeu')?.addEventListener('click', async () => {
    const prev = currentLead.status_prospeccao
    const res = await api('UPDATE_STATUS', { id: currentLead.id, status: 'respondeu', prevStatus: prev })
    if (res.ok) {
      currentLead.status_prospeccao = 'respondeu'
      leadsCache = null; metricsCache = null
      render()
    }
  })
  $('jc-dismiss-banner')?.addEventListener('click', () => {
    $('jc-reply-banner')?.remove()
  })
}

// ─── Aba PIPELINE ────────────────────────────────────────────────────────────
async function renderPipeline() {
  if (!metricsCache) {
    bodyEl.innerHTML = `<div class="jc-spinner">Carregando métricas…</div>`
    const res = await api('METRICS_LEADS')
    if (!res.ok) {
      if (res.error === 'not_authenticated') return renderLoggedOut()
      bodyEl.innerHTML = `<div class="jc-error">Erro ao carregar métricas: ${escapeHtml(res.error)}</div>`
      return
    }
    metricsCache = res.data || []
    if (activeTab !== 'pipeline') return
  }

  const leads = metricsCache
  const byStatus = {}
  STATUS_ORDER.forEach(s => byStatus[s] = 0)
  leads.forEach(l => { if (byStatus[l.status_prospeccao] != null) byStatus[l.status_prospeccao]++ })

  const ativos = FUNNEL_ORDER.reduce((a, s) => a + byStatus[s], 0) - byStatus.fechou
  const fechados = byStatus.fechou
  const novosHoje = leads.filter(l => isToday(l.criado_em)).length
  const followHoje = leads.filter(l => l.data_followup && isTodayOrOverdue(l.data_followup)
    && !['fechou', 'perdido', 'descartado'].includes(l.status_prospeccao)).length

  let h = `
    <div class="jc-metrics">
      <div class="jc-metric accent"><div class="num">${ativos}</div><div class="lbl">Em prospecção</div></div>
      <div class="jc-metric green"><div class="num">${fechados}</div><div class="lbl">Fechados</div></div>
      <div class="jc-metric"><div class="num">${novosHoje}</div><div class="lbl">Novos hoje</div></div>
      <div class="jc-metric"><div class="num">${followHoje}</div><div class="lbl">Follow-ups hoje</div></div>
    </div>

    <div class="jc-section">
      <div class="jc-label">Kanban</div>
      <div class="jc-kanban">
        ${FUNNEL_ORDER.map(s => {
          const c = STATUS_CONFIG[s]
          const colLeads = leads.filter(l => l.status_prospeccao === s)
            .sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em))
            .slice(0, 8)
          return `<div class="jc-kanban-col">
            <div class="jc-kanban-col-head" style="border-top:2px solid ${c.dot}">
              <span style="color:${c.color}">${c.label}</span>
              <span class="jc-kanban-cnt">${byStatus[s]}</span>
            </div>
            ${colLeads.map(l => {
              const nome = l.nome_fantasia || l.razao_social || '—'
              const overdue = l.data_followup && isTodayOrOverdue(l.data_followup)
              return `<div class="jc-kanban-card" data-lead-id="${l.id}">
                <div class="jc-kanban-name">${escapeHtml(nome)}</div>
                ${overdue ? `<div class="jc-kanban-fu">⏰ ${formatDate(l.data_followup)}</div>` : ''}
              </div>`
            }).join('')}
            ${byStatus[s] > 8 ? `<div class="jc-hint" style="padding:4px 6px;font-size:10px">+${byStatus[s]-8} mais</div>` : ''}
          </div>`
        }).join('')}
      </div>
    </div>
  `

  // Follow-ups pendentes
  const pend = leads.filter(l => l.data_followup && isTodayOrOverdue(l.data_followup)
    && !['fechou', 'perdido', 'descartado'].includes(l.status_prospeccao))
    .sort((a, b) => (a.data_followup > b.data_followup ? 1 : -1)).slice(0, 10)

  h += `<div class="jc-section"><div class="jc-label">Follow-ups pendentes</div>`
  if (!pend.length) h += `<div class="jc-hint">Nenhum follow-up pendente. 🎉</div>`
  else h += pend.map(l => leadItemHTML(l, `vence ${formatDate(l.data_followup)}`)).join('')
  h += `</div>`

  bodyEl.innerHTML = h
  bindLeadItemEvents()

  // Kanban cards clicáveis — abre o lead no painel
  bodyEl.querySelectorAll('.jc-kanban-card').forEach(card => {
    card.addEventListener('click', async () => {
      const lead = metricsCache.find(l => l.id === card.dataset.leadId)
      if (!lead) return
      if (activeTab !== 'lead') switchTab('lead')
      bodyEl.innerHTML = `<div class="jc-spinner">Carregando lead…</div>`
      const res = await api('GET_LEAD', { id: lead.id })
      if (res.ok && res.data) { currentLead = res.data; render() }
    })
  })
}

// ─── Aba IA ──────────────────────────────────────────────────────────────────
async function renderIA() {
  const nomeContato = currentChat?.name || ''
  const nomeEmpresa = currentLead?.nome_fantasia || currentLead?.razao_social || nomeContato

  if (!scriptsCache) {
    const res = await api('LIST_SCRIPTS')
    const fromDb = (res?.ok && Array.isArray(res.data)) ? res.data : []
    scriptsCache = fromDb.length
      ? fromDb.map(s => ({ id: s.id, titulo: s.titulo, texto: s.texto, etapa: s.etapa }))
      : FALLBACK_TEMPLATES
  }

  const etapas = [['primeiro', '1º contato'], ['followup', 'Follow-up'], ['proposta', 'Proposta']]
  const tons = [['consultivo', 'Consultivo'], ['casual', 'Casual'], ['direto', 'Direto'], ['curioso', 'Curioso']]

  let h = `
    <div class="jc-section">
      <div class="jc-label">Gerar mensagem com IA</div>
      <div class="jc-card">
        ${nomeContato ? `<div class="jc-hint">Para: <b style="color:var(--jc-text)">${escapeHtml(nomeEmpresa)}</b></div>` : `<div class="jc-hint">Abra uma conversa para personalizar com o nome do contato.</div>`}
        <div class="jc-label" style="margin-top:4px">Etapa</div>
        <div class="jc-seg" id="jc-seg-etapa">
          ${etapas.map(([v, l]) => `<button data-v="${v}" class="${iaState.etapa === v ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        <div class="jc-label">Tom</div>
        <div class="jc-seg" id="jc-seg-tom">
          ${tons.map(([v, l]) => `<button data-v="${v}" class="${iaState.tom === v ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        <textarea class="jc-textarea" id="jc-contexto" placeholder="Contexto extra (opcional): segmento, dor do cliente, gancho…"></textarea>
        <button class="jc-btn" id="jc-generate">✨ Gerar mensagem</button>
        <div id="jc-gen-result">${iaState.result ? iaResultHTML(iaState.result) : ''}</div>
      </div>
    </div>

    <div class="jc-section">
      <div class="jc-label">Templates prontos</div>
      ${scriptsCache.map(t => `
        <div class="jc-card jc-tpl" data-tpl="${escapeHtml(t.id)}" style="margin-bottom:8px">
          <div class="ttl">${escapeHtml(t.titulo)}</div>
          <div class="preview">${escapeHtml((t.texto || '').replace(/\n+/g, ' '))}</div>
          <div class="jc-lead-actions">
            <button class="jc-btn secondary jc-btn-sm jc-tpl-insert" data-tpl="${escapeHtml(t.id)}">Inserir</button>
            <button class="jc-btn ghost jc-btn-sm jc-tpl-copy" data-tpl="${escapeHtml(t.id)}">Copiar</button>
          </div>
        </div>
      `).join('')}
    </div>
  `
  bodyEl.innerHTML = h
  bindIAEvents(nomeContato, nomeEmpresa)
}

function iaResultHTML(text) {
  return `<div class="jc-msg-box" id="jc-msg-text">${escapeHtml(text)}</div>
    <div class="jc-btn-row">
      <button class="jc-btn jc-btn-sm" id="jc-insert-send-msg">Inserir e Enviar</button>
      <button class="jc-btn secondary jc-btn-sm" id="jc-insert-msg">Inserir</button>
      <button class="jc-btn ghost jc-btn-sm" id="jc-copy-msg">Copiar</button>
    </div>`
}

function bindIAEvents(nomeContato, nomeEmpresa) {
  const $ = id => document.getElementById(id)

  document.querySelectorAll('#jc-seg-etapa button').forEach(b => b.addEventListener('click', () => {
    iaState.etapa = b.dataset.v
    document.querySelectorAll('#jc-seg-etapa button').forEach(x => x.classList.toggle('active', x === b))
  }))
  document.querySelectorAll('#jc-seg-tom button').forEach(b => b.addEventListener('click', () => {
    iaState.tom = b.dataset.v
    document.querySelectorAll('#jc-seg-tom button').forEach(x => x.classList.toggle('active', x === b))
  }))

  $('jc-generate')?.addEventListener('click', async () => {
    const btn = $('jc-generate'); btn.disabled = true; btn.textContent = 'Gerando…'
    const res = await api('GENERATE_MESSAGE', { payload: {
      nomeContato, nomeEmpresa,
      contexto: $('jc-contexto').value.trim(),
      tom: iaState.tom, etapa: iaState.etapa,
    }})
    btn.disabled = false; btn.textContent = '✨ Gerar mensagem'
    if (!res.ok) { $('jc-gen-result').innerHTML = `<div class="jc-error">${escapeHtml(res.error)}</div>`; return }
    iaState.result = res.data
    $('jc-gen-result').innerHTML = iaResultHTML(res.data)
    bindResultButtons(res.data)
  })

  if (iaState.result) bindResultButtons(iaState.result)

  document.querySelectorAll('.jc-tpl-insert').forEach(b => b.addEventListener('click', () => {
    insertIntoWhatsApp(fillTemplate(findTpl(b.dataset.tpl), nomeContato, nomeEmpresa))
  }))
  document.querySelectorAll('.jc-tpl-copy').forEach(b => b.addEventListener('click', () => {
    copyText(fillTemplate(findTpl(b.dataset.tpl), nomeContato, nomeEmpresa), b)
  }))
}

function sendWhatsAppMessage() {
  const box = document.querySelector('[data-testid="conversation-compose-box-input"]')
    || document.querySelector('footer [contenteditable="true"]')
  if (!box) return
  box.focus()
  box.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true,
  }))
}

function bindResultButtons(text) {
  document.getElementById('jc-insert-msg')?.addEventListener('click', () => insertIntoWhatsApp(text))
  document.getElementById('jc-copy-msg')?.addEventListener('click', (e) => copyText(text, e.currentTarget))
  document.getElementById('jc-insert-send-msg')?.addEventListener('click', () => {
    insertIntoWhatsApp(text)
    setTimeout(sendWhatsAppMessage, 300)
  })
}

function findTpl(id) { return (scriptsCache || FALLBACK_TEMPLATES).find(t => String(t.id) === String(id)) }
function fillTemplate(t, nome, empresa) {
  if (!t) return ''
  return (t.texto || '').replace(/\[Nome\]/g, nome || 'tudo bem').replace(/\[Empresa\]/g, empresa || 'sua empresa')
}

// ─── Aba LEADS ───────────────────────────────────────────────────────────────
async function renderLeadsTab() {
  if (!leadsCache) {
    bodyEl.innerHTML = `<div class="jc-spinner">Carregando leads…</div>`
    const res = await api('LIST_LEADS')
    if (!res.ok) {
      if (res.error === 'not_authenticated') return renderLoggedOut()
      bodyEl.innerHTML = `<div class="jc-error">Erro ao carregar leads: ${escapeHtml(res.error)}</div>`
      return
    }
    leadsCache = res.data || []
    if (activeTab !== 'leads') return
  }

  if (!leadsCache.length) { bodyEl.innerHTML = `<div class="jc-empty">${IC.leads}<div>Nenhum lead em prospecção ativa.</div></div>`; return }

  bodyEl.innerHTML = `
    <div class="jc-search">${IC.search}<input class="jc-input" id="jc-leads-search" placeholder="Buscar por nome…" /></div>
    <div id="jc-leads-list"></div>`
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
    return `${l.nome_fantasia || ''} ${l.razao_social || ''}`.toLowerCase().includes(q)
  })
  if (!leads.length) { listEl.innerHTML = `<div class="jc-empty">Nenhum lead encontrado.</div>`; return }
  listEl.innerHTML = leads.map(l => leadItemHTML(l)).join('')
  bindLeadItemEvents()
}

function leadItemHTML(l, badge) {
  const cfg = STATUS_CONFIG[l.status_prospeccao] || STATUS_CONFIG.novo
  const canon = normalizePhone(l.telefone)
  const phone = canon ? formatCanonPhone(canon) : (l.telefone || '—')
  const nome = l.nome_fantasia || l.razao_social || 'Sem nome'
  return `
    <div class="jc-card jc-lead-item" data-phone="${escapeHtml(l.telefone || '')}" style="margin-bottom:8px">
      <div class="top">
        <div><div class="nm">${escapeHtml(nome)}</div><div class="ph">${escapeHtml(phone)}</div></div>
        <span class="jc-badge" style="background:${cfg.bg};color:${cfg.color}"><span class="dot" style="background:${cfg.dot}"></span>${cfg.label}</span>
      </div>
      ${badge ? `<div class="jc-hint" style="margin:6px 0 0">⏰ ${escapeHtml(badge)}</div>` : ''}
      <div class="jc-lead-actions">
        <button class="jc-btn secondary jc-btn-sm jc-open-chat" data-phone="${escapeHtml(l.telefone || '')}">Abrir conversa</button>
      </div>
    </div>`
}

function bindLeadItemEvents() {
  document.querySelectorAll('.jc-open-chat').forEach(b => {
    b.addEventListener('click', (e) => { e.stopPropagation(); openChat(b.dataset.phone) })
  })
}

// Seta valor em um <input> React/nativo sem que o React ignore o evento.
function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

// Estratégia 1: busca pela sidebar (ideal para conversas já existentes).
async function searchAndOpenChat(num) {
  const input = document.querySelector('input[aria-label="Pesquisar ou começar uma nova conversa"]')
  if (!input) return false

  input.focus()
  setNativeInputValue(input, num)
  await new Promise(r => setTimeout(r, 700))

  const list = document.querySelector('[data-testid="chat-list"]')
  const firstItem = list?.querySelector('[data-testid="list-item-0"] [data-testid="cell-frame-container"]')
    || list?.querySelector('[data-testid^="list-item-"] [data-testid="cell-frame-container"]')

  if (!firstItem) {
    // Sem resultado — limpa e sinaliza falha para tentar outra estratégia.
    setNativeInputValue(input, '')
    input.blur()
    return false
  }

  firstItem.click()
  await new Promise(r => setTimeout(r, 200))
  setNativeInputValue(input, '')
  input.blur()
  return true
}

// Estratégia 2: drawer "Nova conversa" (funciona para qualquer número,
// mesmo que não esteja nos contatos — o WhatsApp aceita digitar o número).
async function openNewChatDrawer(num) {
  const newChatBtn = document.querySelector('button[aria-label="Nova conversa"]')
  if (!newChatBtn) return false

  newChatBtn.click()
  await waitForElement('[data-testid="new-chat-drawer"]', 2500).catch(() => null)

  const searchInput = document.querySelector('input[aria-label="Pesquisar nome ou número"]')
  if (!searchInput) {
    // Fecha o drawer — pressiona Escape.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return false
  }

  searchInput.focus()
  setNativeInputValue(searchInput, num)
  await new Promise(r => setTimeout(r, 800))

  const firstResult = document.querySelector(
    '[data-testid="new-chat-drawer"] [data-testid="cell-frame-container"]'
  )
  if (!firstResult) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return false
  }

  firstResult.click()
  return true
}

function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) { obs.disconnect(); resolve(el) }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { obs.disconnect(); reject(new Error('timeout')) }, timeout)
  })
}

async function openChatInPlace(num) {
  if (await searchAndOpenChat(num).catch(() => false)) return true
  if (await openNewChatDrawer(num).catch(() => false)) return true
  return false
}

async function openChat(rawPhone) {
  const num = toDialNumber(rawPhone) || (normalizePhone(rawPhone) ? toWhatsappNumber(normalizePhone(rawPhone)) : null)
  if (!num) { alert('Telefone inválido para abrir a conversa.'); return }

  const opened = await openChatInPlace(num).catch(() => false)
  if (!opened) {
    window.open(`https://web.whatsapp.com/send?phone=${num}`, '_blank')
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Inserção robusta no campo de mensagem do WhatsApp
// ════════════════════════════════════════════════════════════════════════════
function insertIntoWhatsApp(text) {
  // Seletor estável baseado em data-testid (não muda com deploy do WhatsApp).
  const box = document.querySelector('[data-testid="conversation-compose-box-input"]')
    || document.querySelector('footer [contenteditable="true"]')
  if (!box) { alert('Não foi possível encontrar o campo de mensagem. Abra a conversa e tente novamente.'); return }
  box.focus()
  const sel = window.getSelection()
  if (sel) { sel.selectAllChildren(box); sel.collapseToEnd() }
  // O Lexical aceita insertText via execCommand (mais confiável que BeforeInputEvent).
  let ok = false
  try { ok = document.execCommand('insertText', false, text) } catch (e) { ok = false }
  if (!ok || !box.textContent.includes(text.slice(0, 12))) {
    box.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }))
    box.dispatchEvent(new InputEvent('input',       { inputType: 'insertText', data: text, bubbles: true }))
  }
  box.focus()
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (!btn) return
    const old = btn.textContent; btn.textContent = 'Copiado!'
    setTimeout(() => { btn.textContent = old }, 1500)
  })
}

// ─── Aba DISPARAR ────────────────────────────────────────────────────────────
async function renderDisparo() {
  if (!leadsCache) {
    bodyEl.innerHTML = `<div class="jc-spinner">Carregando leads…</div>`
    const res = await api('LIST_LEADS')
    if (!res.ok) {
      if (res.error === 'not_authenticated') return renderLoggedOut()
      bodyEl.innerHTML = `<div class="jc-error">Erro: ${escapeHtml(res.error)}</div>`
      return
    }
    leadsCache = res.data || []
    if (activeTab !== 'disparar') return
  }

  if (disparoState.running) return renderDisparoRunning()
  if (disparoState.step === 2) return renderDisparoConfig()
  renderDisparoSelect()
}

function renderDisparoSelect() {
  const leads = leadsCache || []
  const q = (document.getElementById('jc-disp-search')?.value || '').toLowerCase()
  const filtered = q ? leads.filter(l =>
    (l.nome_fantasia || l.razao_social || '').toLowerCase().includes(q) ||
    (l.telefone || '').includes(q)
  ) : leads

  let h = `
    <div class="jc-section">
      <div class="jc-label">🚀 Disparo em lote</div>
      <div class="jc-hint">⚠️ Use com moderação — envios em massa podem resultar em banimento da conta pelo WhatsApp.</div>
      <div class="jc-search">
        ${IC.search}
        <input class="jc-input" id="jc-disp-search" placeholder="Filtrar leads…" value="" style="padding-left:32px" />
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="jc-hint" style="margin:0">${disparoState.selected.size} selecionado(s)</span>
        <button class="jc-btn ghost jc-btn-sm" id="jc-disp-selall">Selecionar todos</button>
      </div>
      <div class="jc-disp-list">
        ${filtered.map(l => {
          const nome = l.nome_fantasia || l.razao_social || '—'
          const cfg = STATUS_CONFIG[l.status_prospeccao] || STATUS_CONFIG.novo
          const checked = disparoState.selected.has(l.id)
          return `<label class="jc-disp-item ${checked ? 'selected' : ''}">
            <input type="checkbox" data-id="${l.id}" data-phone="${escapeHtml(l.telefone || '')}" ${checked ? 'checked' : ''} />
            <div class="jc-disp-item-info">
              <div class="nm">${escapeHtml(nome)}</div>
              <span class="jc-badge" style="background:${cfg.bg};color:${cfg.color}"><span class="dot" style="background:${cfg.dot}"></span>${cfg.label}</span>
            </div>
          </label>`
        }).join('')}
        ${!filtered.length ? '<div class="jc-hint">Nenhum lead encontrado.</div>' : ''}
      </div>
      <button class="jc-btn" id="jc-disp-next" ${disparoState.selected.size === 0 ? 'disabled' : ''} style="margin-top:12px;width:100%">
        Configurar envio (${disparoState.selected.size}) →
      </button>
    </div>
  `
  bodyEl.innerHTML = h

  document.getElementById('jc-disp-search')?.addEventListener('input', () => renderDisparoSelect())
  document.getElementById('jc-disp-selall')?.addEventListener('click', () => {
    const allIds = filtered.map(l => l.id)
    const allSelected = allIds.every(id => disparoState.selected.has(id))
    if (allSelected) allIds.forEach(id => disparoState.selected.delete(id))
    else allIds.forEach(id => disparoState.selected.add(id))
    renderDisparoSelect()
  })
  bodyEl.querySelectorAll('.jc-disp-item input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) disparoState.selected.add(cb.dataset.id)
      else disparoState.selected.delete(cb.dataset.id)
      document.getElementById('jc-disp-next')?.setAttribute('disabled', '')
      if (disparoState.selected.size > 0) document.getElementById('jc-disp-next')?.removeAttribute('disabled')
      document.getElementById('jc-disp-next').textContent = `Configurar envio (${disparoState.selected.size}) →`
      cb.closest('.jc-disp-item').classList.toggle('selected', cb.checked)
    })
  })
  document.getElementById('jc-disp-next')?.addEventListener('click', () => {
    if (disparoState.selected.size === 0) return
    disparoState.step = 2
    renderDisparoConfig()
  })
}

function renderDisparoConfig() {
  const selectedLeads = (leadsCache || []).filter(l => disparoState.selected.has(l.id))
  const tpl = disparoState.template
  const delay = disparoState.delay

  bodyEl.innerHTML = `
    <div class="jc-section">
      <div class="jc-label">🚀 Configurar disparo</div>
      <div class="jc-hint">${selectedLeads.length} lead(s) selecionado(s)</div>

      <div class="jc-label">Mensagem</div>
      <div class="jc-hint">Use <b>[Nome]</b> e <b>[Empresa]</b> para personalizar.</div>
      <textarea class="jc-textarea" id="jc-disp-tpl" placeholder="Oi [Nome]! Somos a Justo Mídias e ajudamos [Empresa] a…" style="min-height:110px">${escapeHtml(tpl)}</textarea>

      <div class="jc-label" style="margin-top:4px">Intervalo entre envios</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <input type="range" id="jc-disp-delay" min="20" max="120" step="5" value="${delay}" style="flex:1" />
        <span id="jc-disp-delay-val" style="font-family:monospace;min-width:40px">${delay}s</span>
      </div>
      ${delay < 30 ? `<div class="jc-error" style="margin-bottom:8px">⚠️ Menos de 30s aumenta risco de bloqueio.</div>` : ''}

      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="jc-btn ghost jc-btn-sm" id="jc-disp-back">← Voltar</button>
        <button class="jc-btn" id="jc-disp-start" style="flex:1">Iniciar disparo 🚀</button>
      </div>
    </div>
  `
  document.getElementById('jc-disp-delay')?.addEventListener('input', e => {
    disparoState.delay = Number(e.target.value)
    document.getElementById('jc-disp-delay-val').textContent = `${disparoState.delay}s`
    if (disparoState.delay < 30) renderDisparoConfig()
  })
  document.getElementById('jc-disp-tpl')?.addEventListener('input', e => { disparoState.template = e.target.value })
  document.getElementById('jc-disp-back')?.addEventListener('click', () => { disparoState.step = 1; renderDisparoSelect() })
  document.getElementById('jc-disp-start')?.addEventListener('click', () => {
    const tmpl = document.getElementById('jc-disp-tpl').value.trim()
    if (!tmpl) { alert('Escreva a mensagem antes de disparar.'); return }
    disparoState.template = tmpl
    disparoState.running = true
    disparoState.idx = 0
    disparoState.log = []
    runDisparoLoop(selectedLeads)
  })
}

async function runDisparoLoop(leads) {
  for (let i = 0; i < leads.length; i++) {
    disparoState.idx = i
    renderDisparoRunning(leads)
    if (!disparoState.running) break

    const l = leads[i]
    const nome = l.nome_fantasia || l.razao_social || ''
    const msg = disparoState.template
      .replace(/\[Nome\]/g, nome)
      .replace(/\[Empresa\]/g, nome)

    try {
      const opened = await openChatInPlace(
        toDialNumber(l.telefone) || (normalizePhone(l.telefone) ? toWhatsappNumber(normalizePhone(l.telefone)) : '')
      ).catch(() => false)
      if (!opened) throw new Error('Não foi possível abrir a conversa')

      await new Promise(r => setTimeout(r, 1500))
      insertIntoWhatsApp(msg)
      await new Promise(r => setTimeout(r, 400))
      sendWhatsAppMessage()
      disparoState.log.push({ nome, status: 'ok' })
    } catch (e) {
      disparoState.log.push({ nome, status: 'erro', msg: e.message })
    }

    if (i < leads.length - 1) {
      await new Promise(r => setTimeout(r, disparoState.delay * 1000))
    }
  }
  disparoState.running = false
  disparoState.idx = leads.length
  renderDisparoRunning(leads)
}

function renderDisparoRunning(leads) {
  leads = leads || (leadsCache || []).filter(l => disparoState.selected.has(l.id))
  const total = leads.length
  const done = disparoState.log.length
  const current = disparoState.running ? (leads[disparoState.idx]?.nome_fantasia || leads[disparoState.idx]?.razao_social || '') : ''
  const pct = total ? Math.round((done / total) * 100) : 0

  let h = `
    <div class="jc-section">
      <div class="jc-label">${disparoState.running ? '🚀 Disparando…' : '✅ Disparo concluído'}</div>
      <div style="margin:10px 0">
        <div style="background:var(--jc-bg3);border-radius:4px;height:8px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--jc-accent);transition:width 0.4s"></div>
        </div>
        <div class="jc-hint" style="margin-top:6px">${done}/${total} enviados ${current ? `• enviando para <b>${escapeHtml(current)}</b>` : ''}</div>
      </div>
      ${disparoState.running ? `<button class="jc-btn ghost jc-btn-sm" id="jc-disp-stop">Parar</button>` : `<button class="jc-btn secondary jc-btn-sm" id="jc-disp-reset">Novo disparo</button>`}
      <div class="jc-disp-log">
        ${disparoState.log.slice().reverse().map(e =>
          `<div class="jc-disp-log-row ${e.status}">
            <span>${e.status === 'ok' ? '✓' : '✗'}</span>
            <span>${escapeHtml(e.nome)}</span>
            ${e.msg ? `<span style="color:var(--jc-red);font-size:10px">${escapeHtml(e.msg)}</span>` : ''}
          </div>`
        ).join('')}
      </div>
    </div>
  `
  if (bodyEl) bodyEl.innerHTML = h
  document.getElementById('jc-disp-stop')?.addEventListener('click', () => { disparoState.running = false })
  document.getElementById('jc-disp-reset')?.addEventListener('click', () => {
    disparoState.step = 1; disparoState.selected = new Set()
    disparoState.log = []; disparoState.running = false
    renderDisparoSelect()
  })
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (/^\+?\d/.test(parts[0])) return '#'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}
function parseNotas(json) { try { return JSON.parse(json || '[]') } catch { return [] } }
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}
function isTodayOrOverdue(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr.length === 10 ? dateStr + 'T23:59:59' : dateStr)
  return d.getTime() <= Date.now() || isToday(dateStr)
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const bootObserver = new MutationObserver(() => {
  if (document.querySelector('#app') && !document.getElementById('justo-crm-panel')) injectPanel()
})
bootObserver.observe(document.body, { childList: true, subtree: true })
if (document.querySelector('#app')) injectPanel()
