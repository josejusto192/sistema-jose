import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase.js'
import { IconInbox, IconWhatsApp, IconMail, IconSearch, IconCheck, IconPaperclip, IconX, IconMic, IconSquare, IconTrash, IconArrowLeft, IconPlus } from './Icons.jsx'
import '../styles/communications.css'

// Ordem de preferência de formato pro MediaRecorder — só entra na lista o
// que o navegador realmente sabe gravar (varia entre Chrome/Firefox/Safari).
const AUDIO_MIME_PREF = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm']

function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined') return null
  return AUDIO_MIME_PREF.find(m => MediaRecorder.isTypeSupported(m)) || null
}

// Canais suportados. Por enquanto só o WhatsApp está ativo — Instagram e os
// próximos entram aqui conforme as integrações forem ficando prontas.
const CANAIS = [
  { id: 'whatsapp',  label: 'WhatsApp (API Oficial)',  Icon: IconWhatsApp, color: '#25D366', ativo: true },
  { id: 'email',     label: 'Email',     Icon: IconMail,     color: '#3B82F6', ativo: true },
  { id: 'instagram', label: 'Instagram', Icon: IconInbox,    color: '#E1306C', ativo: false },
]

function last8(digits) {
  return (digits || '').replace(/\D/g, '').slice(-8)
}

// Acha o lead cujo telefone bate com os últimos 8 dígitos do session_id
// (wa_id da Cloud API) — mesma lógica usada na extensão de WhatsApp.
function matchLead(sessionId, empresas) {
  const target = last8(sessionId)
  if (!target) return null
  return empresas.find(e => last8(e.telefone) === target) || null
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Tipo aceito pela Cloud API a partir do mime do arquivo escolhido.
function mediaTypeFromMime(mime) {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

const MEDIA_PREVIEW_LABEL = {
  image: '📷 Foto', sticker: '📷 Figurinha', video: '🎥 Vídeo', audio: '🎤 Áudio', document: '📎 Documento',
}

function previewMensagem(c) {
  if (c.ultima_mensagem) return c.ultima_mensagem
  return MEDIA_PREVIEW_LABEL[c.ultimo_tipo] || ''
}

function MediaBubbleContent({ m }) {
  if (!m.media_url) return m.content
  if (m.message_type === 'image' || m.message_type === 'sticker') {
    return (
      <>
        <a className="message-media-link" href={m.media_url} target="_blank" rel="noopener noreferrer" aria-label="Abrir imagem em uma nova aba">
          <img className="message-media-preview" src={m.media_url} alt={m.content || 'Imagem enviada na conversa'} />
        </a>
        {m.content && <div className="message-media-caption">{m.content}</div>}
      </>
    )
  }
  if (m.message_type === 'video') {
    return (
      <>
        <video className="message-media-preview" src={m.media_url} controls aria-label="Vídeo enviado na conversa" />
        {m.content && <div className="message-media-caption">{m.content}</div>}
      </>
    )
  }
  if (m.message_type === 'audio') {
    return <audio className="message-audio" src={m.media_url} controls aria-label="Áudio enviado na conversa" />
  }
  return (
    <a className="message-document-link" href={m.media_url} target="_blank" rel="noopener noreferrer">
      📎 {m.content || 'Documento'}
    </a>
  )
}

export default function CaixaEntrada({ empresas = [], onOpenLead }) {
  const [canal, setCanal] = useState('whatsapp')
  const [busca, setBusca] = useState('')
  const [conversas, setConversas] = useState([])
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState(null)
  const [arquivo, setArquivo] = useState(null)
  const [gravando, setGravando] = useState(false)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const canceladoRef = useRef(false)

  // Email: estado separado (sem mídia/áudio — só texto, num thread por lead).
  const [conversasEmail, setConversasEmail] = useState([])
  const [loadingConversasEmail, setLoadingConversasEmail] = useState(true)
  const [threadKeyEmail, setThreadKeyEmail] = useState(null)
  const [pastaEmail, setPastaEmail] = useState('inbox') // 'inbox' | 'spam'
  const [mensagensEmail, setMensagensEmail] = useState([])
  const [loadingMsgsEmail, setLoadingMsgsEmail] = useState(false)
  const [textoEmail, setTextoEmail] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [erroEnvioEmail, setErroEnvioEmail] = useState(null)
  const scrollEmailRef = useRef(null)

  // Nova mensagem do zero (prospecção manual, sem conversa/lead prévio).
  const [mostrarNovaMsgEmail, setMostrarNovaMsgEmail] = useState(false)
  const [novaMsgPara, setNovaMsgPara] = useState('')
  const [novaMsgAssunto, setNovaMsgAssunto] = useState('')
  const [novaMsgTexto, setNovaMsgTexto] = useState('')
  const [enviandoNovaMsg, setEnviandoNovaMsg] = useState(false)
  const [erroNovaMsg, setErroNovaMsg] = useState(null)

  const loadConversas = useCallback(async () => {
    setLoadingConversas(true)
    const { data, error } = await supabase
      .from('whatsapp_conversas_resumo')
      .select('*')
      .order('ultima_mensagem_em', { ascending: false })
      .limit(200)
    if (!error) setConversas(data || [])
    setLoadingConversas(false)
  }, [])

  useEffect(() => { loadConversas() }, [loadConversas])

  // Realtime: qualquer insert/update em whatsapp_messages atualiza a lista.
  useEffect(() => {
    const ch = supabase.channel('whatsapp-conversas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
        loadConversas()
        if (sessionId) loadMensagens(sessionId)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadConversas, sessionId])

  const loadMensagens = useCallback(async (sid) => {
    setLoadingMsgs(true)
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })
      .limit(500)
    if (!error) setMensagens(data || [])
    setLoadingMsgs(false)
  }, [])

  async function openConversa(sid) {
    setSessionId(sid)
    setErroEnvio(null)
    await loadMensagens(sid)
    await supabase.from('whatsapp_messages')
      .update({ lida_pelo_agente: true })
      .eq('session_id', sid)
      .eq('direction', 'inbound')
      .eq('lida_pelo_agente', false)
    setConversas(prev => prev.map(c => c.session_id === sid ? { ...c, nao_lidas: 0 } : c))
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [mensagens])

  const loadConversasEmail = useCallback(async () => {
    setLoadingConversasEmail(true)
    const { data, error } = await supabase
      .from('email_conversas_resumo')
      .select('*')
      .order('ultima_mensagem_em', { ascending: false })
      .limit(200)
    if (!error) setConversasEmail(data || [])
    setLoadingConversasEmail(false)
  }, [])

  useEffect(() => { if (canal === 'email') loadConversasEmail() }, [canal, loadConversasEmail])

  useEffect(() => {
    if (canal !== 'email') return
    const ch = supabase.channel('email-conversas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_conversas_mensagens' }, () => {
        loadConversasEmail()
        if (threadKeyEmail) loadMensagensEmail(threadKeyEmail)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [canal, loadConversasEmail, threadKeyEmail])

  const loadMensagensEmail = useCallback(async (threadKey) => {
    setLoadingMsgsEmail(true)
    const { data, error } = await supabase
      .from('email_conversas_mensagens')
      .select('*')
      .eq('thread_key', threadKey)
      .order('created_at', { ascending: true })
      .limit(500)
    if (!error) setMensagensEmail(data || [])
    setLoadingMsgsEmail(false)
  }, [])

  async function openConversaEmail(threadKey) {
    setThreadKeyEmail(threadKey)
    setErroEnvioEmail(null)
    await loadMensagensEmail(threadKey)
    await supabase.from('email_conversas_mensagens')
      .update({ lida_pelo_agente: true })
      .eq('thread_key', threadKey)
      .eq('direction', 'inbound')
      .eq('lida_pelo_agente', false)
    setConversasEmail(prev => prev.map(c => c.thread_key === threadKey ? { ...c, nao_lidas: 0 } : c))
  }

  useEffect(() => {
    scrollEmailRef.current?.scrollTo({ top: scrollEmailRef.current.scrollHeight })
  }, [mensagensEmail])

  async function enviarEmail() {
    const txt = textoEmail.trim()
    const conversa = conversasEmailComLead.find(c => c.thread_key === threadKeyEmail)
    if (!txt || !conversa || enviandoEmail) return
    setEnviandoEmail(true)
    setErroEnvioEmail(null)
    const corpoHtml = txt.split(/\n+/).map(p => `<p>${p}</p>`).join('')
    const body = conversa.lead_id
      ? { lead_id: conversa.lead_id, corpo_html: corpoHtml }
      : { thread_key: conversa.thread_key, destinatario_email: conversa.contato_email, corpo_html: corpoHtml }
    const { data, error } = await supabase.functions.invoke('email-reply-send', { body })
    setEnviandoEmail(false)
    if (error || data?.error) {
      let msg = data?.error || error?.message || 'Erro ao enviar email'
      if (error?.context) {
        try {
          const errBody = await error.context.json()
          if (errBody?.error) msg = errBody.error
        } catch {}
      }
      setErroEnvioEmail(msg)
      return
    }
    setTextoEmail('')
    await loadMensagensEmail(threadKeyEmail)
    loadConversasEmail()
  }

  async function enviarNovaMensagemEmail() {
    const para = novaMsgPara.trim()
    const assunto = novaMsgAssunto.trim()
    const txt = novaMsgTexto.trim()
    if (!para || !assunto || !txt || enviandoNovaMsg) return
    setEnviandoNovaMsg(true)
    setErroNovaMsg(null)
    const corpoHtml = txt.split(/\n+/).map(p => `<p>${p}</p>`).join('')
    const { data, error } = await supabase.functions.invoke('email-reply-send', {
      body: { destinatario_email: para, assunto, corpo_html: corpoHtml },
    })
    setEnviandoNovaMsg(false)
    if (error || data?.error) {
      let msg = data?.error || error?.message || 'Erro ao enviar email'
      if (error?.context) {
        try {
          const errBody = await error.context.json()
          if (errBody?.error) msg = errBody.error
        } catch {}
      }
      setErroNovaMsg(msg)
      return
    }
    setMostrarNovaMsgEmail(false)
    setNovaMsgPara('')
    setNovaMsgAssunto('')
    setNovaMsgTexto('')
    await loadConversasEmail()
    setPastaEmail('enviados')
    setThreadKeyEmail(para.toLowerCase())
    await loadMensagensEmail(para.toLowerCase())
  }

  // Para a stream do microfone sempre que o componente desmontar com uma
  // gravação em andamento (ex: troca de conversa ou de tela).
  useEffect(() => () => streamRef.current?.getTracks().forEach(t => t.stop()), [])

  async function iniciarGravacao() {
    setErroEnvio(null)
    const mime = pickAudioMime()
    if (!mime) {
      setErroEnvio('Seu navegador não suporta gravação de áudio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      canceladoRef.current = false
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (!canceladoRef.current && chunksRef.current.length) {
          const baseMime = mime.split(';')[0]
          const blob = new Blob(chunksRef.current, { type: baseMime })
          const ext = baseMime.split('/')[1]
          setArquivo(new File([blob], `audio-${Date.now()}.${ext}`, { type: baseMime }))
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setGravando(true)
      setTempoGravacao(0)
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000)
    } catch {
      setErroEnvio('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  function pararGravacao(cancelar) {
    canceladoRef.current = !!cancelar
    recorderRef.current?.stop()
    clearInterval(timerRef.current)
    setGravando(false)
  }

  async function enviar() {
    const txt = texto.trim()
    if ((!txt && !arquivo) || !sessionId || enviando) return
    setEnviando(true)
    setErroEnvio(null)

    let body = { session_id: sessionId, texto: txt }

    if (arquivo) {
      const mediaType = mediaTypeFromMime(arquivo.type)
      const ext = arquivo.name.split('.').pop() || 'bin'
      const path = `${sessionId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, arquivo, { contentType: arquivo.type })
      if (upErr) {
        setEnviando(false)
        setErroEnvio('Erro ao subir o arquivo: ' + upErr.message)
        return
      }
      const { data: pub } = supabase.storage.from('whatsapp-media').getPublicUrl(path)
      body = { ...body, media_url: pub.publicUrl, media_type: mediaType, mime_type: arquivo.type }
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-send', { body })
    setEnviando(false)
    if (error || data?.error) {
      // O client do Supabase esconde o corpo real da resposta de erro da
      // function atrás de uma mensagem genérica ("non-2xx status code");
      // o JSON de verdade só vem em error.context (a Response original).
      let msg = data?.error || error?.message || 'Erro ao enviar mensagem'
      if (error?.context) {
        try {
          const errBody = await error.context.json()
          if (errBody?.error) msg = errBody.error
        } catch {}
      }
      setErroEnvio(msg)
      return
    }
    setTexto('')
    setArquivo(null)
    await loadMensagens(sessionId)
    loadConversas()
  }

  const conversasComLead = useMemo(
    () => conversas.map(c => ({ ...c, lead: matchLead(c.session_id, empresas) })),
    [conversas, empresas]
  )

  const conversasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return conversasComLead
    return conversasComLead.filter(c =>
      c.session_id.includes(q) ||
      (c.lead?.nome_fantasia || c.lead?.razao_social || '').toLowerCase().includes(q) ||
      (c.ultima_mensagem || '').toLowerCase().includes(q)
    )
  }, [conversasComLead, busca])

  const conversaAtual = conversasComLead.find(c => c.session_id === sessionId)

  const conversasEmailComLead = useMemo(
    () => conversasEmail.map(c => ({ ...c, lead: c.lead_id ? (empresas.find(e => e.id === c.lead_id) || null) : null })),
    [conversasEmail, empresas]
  )

  const conversasEmailPorPasta = useMemo(() => {
    if (pastaEmail === 'enviados') return conversasEmailComLead.filter(c => c.ultima_direcao === 'outbound')
    return conversasEmailComLead.filter(c => (c.pasta || 'inbox') === pastaEmail)
  }, [conversasEmailComLead, pastaEmail])

  const conversasEmailFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return conversasEmailPorPasta
    return conversasEmailPorPasta.filter(c =>
      (c.lead?.nome_fantasia || c.lead?.razao_social || '').toLowerCase().includes(q) ||
      (c.lead?.email || c.contato_email || '').toLowerCase().includes(q) ||
      (c.ultima_mensagem || '').toLowerCase().includes(q)
    )
  }, [conversasEmailPorPasta, busca])

  const conversaEmailAtual = conversasEmailComLead.find(c => c.thread_key === threadKeyEmail)
  const canalAtual = CANAIS.find(c => c.id === canal)
  const temConversaAtiva = canal === 'whatsapp' ? !!sessionId : !!threadKeyEmail

  return (
    <div className={`communications-inbox${temConversaAtiva ? ' has-active-thread' : ''}`}>
      {/* Coluna: canais + lista de conversas */}
      <aside className="inbox-master" aria-label="Lista de conversas">
        <div className="inbox-master-heading">
          <div>
            <span className="inbox-eyebrow">Central de conversas</span>
            <h2>Caixa de entrada</h2>
          </div>
          <span className="inbox-live-indicator" title="Atualizações em tempo real">Ao vivo</span>
        </div>

        {/* Abas de canal */}
        <div className="inbox-channel-tabs" role="tablist" aria-label="Canais de atendimento">
          {CANAIS.map(c => (
            <button
              key={c.id}
              onClick={() => c.ativo && setCanal(c.id)}
              disabled={!c.ativo}
              title={c.ativo ? c.label : `${c.label} — em breve`}
              className={`inbox-channel-tab${canal === c.id ? ' is-active' : ''}`}
              role="tab"
              aria-selected={canal === c.id}
            >
              <c.Icon size={13} color={canal === c.id ? '#fff' : c.color} />
              <span>{c.id === 'whatsapp' ? 'WhatsApp' : c.label}</span>
              {!c.ativo && <span className="inbox-soon-label">Em breve</span>}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="inbox-search-wrap">
          <div className="inbox-search">
            <span aria-hidden="true">
              <IconSearch size={13} color="var(--text3)" />
            </span>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              aria-label="Buscar conversa"
            />
          </div>
        </div>

        {/* Lista de conversas */}
        <div className="inbox-thread-list" role="tabpanel">
          {canal === 'whatsapp' && (<>
          {loadingConversas && (
            <div className="inbox-loading" role="status">Carregando conversas...</div>
          )}

          {!loadingConversas && conversasFiltradas.length === 0 && (
            <div className="inbox-list-empty">
              <IconInbox size={36} color="var(--border)" />
              <strong>Nenhuma conversa ainda</strong>
              <span>
                As conversas do {canalAtual?.label} vão aparecer aqui automaticamente.
              </span>
            </div>
          )}

          {conversasFiltradas.map(c => {
            const nome = c.lead?.nome_fantasia || c.lead?.razao_social || c.session_id
            const ativa = c.session_id === sessionId
            return (
              <button
                key={c.session_id}
                onClick={() => openConversa(c.session_id)}
                className={`inbox-thread-item${ativa ? ' is-active' : ''}${c.nao_lidas > 0 ? ' has-unread' : ''}`}
                aria-current={ativa ? 'true' : undefined}
              >
                <div className="inbox-thread-avatar" aria-hidden="true">
                  {nome.slice(0, 1).toUpperCase()}
                </div>
                <div className="inbox-thread-copy">
                  <div className="inbox-thread-topline">
                    <span className="inbox-thread-name">
                      {nome}
                    </span>
                    <time>{formatDay(c.ultima_mensagem_em)}</time>
                  </div>
                  <div className="inbox-thread-preview-row">
                    <span className="inbox-thread-preview">
                      {c.ultima_direcao === 'outbound' ? 'Você: ' : ''}{previewMensagem(c)}
                    </span>
                    {c.nao_lidas > 0 && (
                      <span className="inbox-unread-count" aria-label={`${c.nao_lidas} mensagens não lidas`}>
                        {c.nao_lidas}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
          </>)}

          {canal === 'email' && (<>
          <div className="inbox-new-email-wrap">
            <button
              onClick={() => { setMostrarNovaMsgEmail(true); setErroNovaMsg(null) }}
              className="inbox-new-email"
            >
              <IconPlus size={13} color="#fff" /> Nova mensagem
            </button>
          </div>
          <div className="inbox-folder-tabs" role="tablist" aria-label="Pastas de email">
            {[['inbox', 'Recebidos'], ['enviados', 'Enviados'], ['spam', 'Spam']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPastaEmail(id)}
                className={pastaEmail === id ? 'is-active' : ''}
                role="tab"
                aria-selected={pastaEmail === id}
              >
                {label}
              </button>
            ))}
          </div>
          {loadingConversasEmail && (
            <div className="inbox-loading" role="status">Carregando conversas...</div>
          )}

          {!loadingConversasEmail && conversasEmailFiltradas.length === 0 && (
            <div className="inbox-list-empty">
              <IconMail size={36} color="var(--border)" />
              <strong>Nenhuma conversa ainda</strong>
              <span>
                Emails enviados e respostas dos leads vão aparecer aqui automaticamente.
              </span>
            </div>
          )}

          {conversasEmailFiltradas.map(c => {
            const nome = c.lead?.nome_fantasia || c.lead?.razao_social || c.lead?.email || c.contato_nome || c.contato_email || c.thread_key
            const ativa = c.thread_key === threadKeyEmail
            return (
              <button
                key={c.thread_key}
                onClick={() => openConversaEmail(c.thread_key)}
                className={`inbox-thread-item${ativa ? ' is-active' : ''}${c.nao_lidas > 0 ? ' has-unread' : ''}`}
                aria-current={ativa ? 'true' : undefined}
              >
                <div className="inbox-thread-avatar is-email" aria-hidden="true">
                  {nome.slice(0, 1).toUpperCase()}
                </div>
                <div className="inbox-thread-copy">
                  <div className="inbox-thread-topline">
                    <span className="inbox-thread-name">
                      {nome}
                    </span>
                    <time>{formatDay(c.ultima_mensagem_em)}</time>
                  </div>
                  <div className="inbox-thread-preview-row">
                    <span className="inbox-thread-preview">
                      {c.ultima_direcao === 'outbound' ? 'Você: ' : ''}{(c.ultima_mensagem || '').replace(/<[^>]+>/g, '').slice(0, 80)}
                    </span>
                    {c.nao_lidas > 0 && (
                      <span className="inbox-unread-count" aria-label={`${c.nao_lidas} mensagens não lidas`}>
                        {c.nao_lidas}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
          </>)}
        </div>
      </aside>

      {/* Painel da conversa selecionada */}
      {canal === 'whatsapp' && (<>
      {!sessionId && (
        <div className="inbox-empty-detail">
          <div className="inbox-empty-detail-card">
            <div className="inbox-empty-icon is-whatsapp">
              <IconWhatsApp size={26} color="#25D366" />
            </div>
            <strong>Suas conversas, em um só lugar</strong>
            <p>
              Selecione uma conversa à esquerda para ver as mensagens e responder direto por aqui.
            </p>
          </div>
        </div>
      )}

      {sessionId && (
        <section className="inbox-detail" aria-label="Conversa do WhatsApp">
          {/* Header da conversa */}
          <header className="inbox-detail-header">
            <button className="inbox-mobile-back" onClick={() => setSessionId(null)} aria-label="Voltar para a lista de conversas">
              <IconArrowLeft size={18} />
            </button>
            <div className="inbox-detail-avatar" aria-hidden="true">
              {(conversaAtual?.lead?.nome_fantasia || conversaAtual?.lead?.razao_social || sessionId).slice(0, 1).toUpperCase()}
            </div>
            <div className="inbox-detail-identity">
              <strong>
                {conversaAtual?.lead?.nome_fantasia || conversaAtual?.lead?.razao_social || sessionId}
              </strong>
              <span><i /> WhatsApp · {sessionId}</span>
            </div>
            {conversaAtual?.lead && (
              <button
                onClick={() => onOpenLead?.(conversaAtual.lead)}
                className="inbox-view-lead"
              >
                Ver lead
              </button>
            )}
          </header>

          {/* Mensagens */}
          <div ref={scrollRef} className="inbox-messages" aria-live="polite">
            {loadingMsgs && <div className="inbox-loading" role="status">Carregando mensagens...</div>}
            {!loadingMsgs && mensagens.map(m => {
              const out = m.direction === 'outbound'
              return (
                <div key={m.id} className={`inbox-message-row ${out ? 'is-outbound' : 'is-inbound'}`}>
                  <div className="inbox-message-bubble">
                    <MediaBubbleContent m={m} />
                    <div className="inbox-message-meta">
                      {formatTime(m.created_at)}
                      {out && m.whatsapp_status === 'read' && <IconCheck size={10} color={out ? '#fff' : 'var(--text3)'} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Composição */}
          <footer className="inbox-composer">
            {erroEnvio && (
              <div className="inbox-error" role="alert">{erroEnvio}</div>
            )}
            {arquivo && (
              <div className="inbox-attachment-chip">
                <IconPaperclip size={12} color="var(--text3)" />
                <span>{arquivo.name}</span>
                <button onClick={() => { setArquivo(null); if (fileInputRef.current) fileInputRef.current.value = '' }} aria-label="Remover anexo">
                  <IconX size={12} color="var(--text3)" />
                </button>
              </div>
            )}
            {gravando ? (
              <div className="inbox-recording">
                <span className="inbox-recording-dot" />
                <span>
                  Gravando... {String(Math.floor(tempoGravacao / 60)).padStart(2, '0')}:{String(tempoGravacao % 60).padStart(2, '0')}
                </span>
                <button className="inbox-tool-button" onClick={() => pararGravacao(true)} title="Cancelar" aria-label="Cancelar gravação">
                  <IconTrash size={14} />
                </button>
                <button className="inbox-tool-button is-primary" onClick={() => pararGravacao(false)} title="Concluir gravação" aria-label="Concluir gravação">
                  <IconSquare size={13} />
                </button>
              </div>
            ) : (
              <div className="inbox-compose-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => setArquivo(e.target.files?.[0] || null)}
                  aria-label="Selecionar arquivo para anexar"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo"
                  className="inbox-tool-button"
                  aria-label="Anexar arquivo"
                >
                  <IconPaperclip size={15} />
                </button>
                <button
                  onClick={iniciarGravacao}
                  title="Gravar áudio"
                  className="inbox-tool-button"
                  aria-label="Gravar áudio"
                >
                  <IconMic size={15} />
                </button>
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder={arquivo ? 'Adicionar legenda (opcional)...' : 'Digite uma mensagem...'}
                  rows={1}
                  aria-label="Mensagem do WhatsApp"
                />
                <button
                  onClick={enviar}
                  disabled={(!texto.trim() && !arquivo) || enviando}
                  className="inbox-send-button"
                  aria-label="Enviar mensagem"
                >
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            )}
          </footer>
        </section>
      )}
      </>)}

      {canal === 'email' && (<>
      {!threadKeyEmail && (
        <div className="inbox-empty-detail">
          <div className="inbox-empty-detail-card">
            <div className="inbox-empty-icon is-email">
              <IconMail size={26} color="#3B82F6" />
            </div>
            <strong>Email com contexto, sem perder o fio</strong>
            <p>
              Selecione uma conversa à esquerda para ver as mensagens e responder direto por aqui.
            </p>
          </div>
        </div>
      )}

      {threadKeyEmail && (
        <section className="inbox-detail" aria-label="Conversa por email">
          {/* Header da conversa */}
          <header className="inbox-detail-header">
            <button className="inbox-mobile-back" onClick={() => setThreadKeyEmail(null)} aria-label="Voltar para a lista de conversas">
              <IconArrowLeft size={18} />
            </button>
            <div className="inbox-detail-avatar is-email" aria-hidden="true">
              {(conversaEmailAtual?.lead?.nome_fantasia || conversaEmailAtual?.lead?.razao_social || conversaEmailAtual?.contato_nome || conversaEmailAtual?.contato_email || threadKeyEmail).slice(0, 1).toUpperCase()}
            </div>
            <div className="inbox-detail-identity">
              <strong>
                {conversaEmailAtual?.lead?.nome_fantasia || conversaEmailAtual?.lead?.razao_social || conversaEmailAtual?.lead?.email || conversaEmailAtual?.contato_nome || conversaEmailAtual?.contato_email || threadKeyEmail}
              </strong>
              <span>Email · {conversaEmailAtual?.lead?.email || conversaEmailAtual?.contato_email}</span>
            </div>
            {conversaEmailAtual?.lead && (
              <button
                onClick={() => onOpenLead?.(conversaEmailAtual.lead)}
                className="inbox-view-lead"
              >
                Ver lead
              </button>
            )}
          </header>

          {/* Mensagens */}
          <div ref={scrollEmailRef} className="inbox-messages" aria-live="polite">
            {loadingMsgsEmail && <div className="inbox-loading" role="status">Carregando mensagens...</div>}
            {!loadingMsgsEmail && mensagensEmail.map(m => {
              const out = m.direction === 'outbound'
              return (
                <div key={m.id} className={`inbox-message-row ${out ? 'is-outbound' : 'is-inbound'}`}>
                  <div className="inbox-message-bubble is-email">
                    {m.assunto && <div className="inbox-email-subject">{m.assunto}</div>}
                    <div className="inbox-email-body" dangerouslySetInnerHTML={{ __html: m.corpo_html || (m.corpo_texto || '').replace(/\n/g, '<br>') }} />
                    <div className="inbox-message-meta">
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Composição */}
          <footer className="inbox-composer">
            {erroEnvioEmail && (
              <div className="inbox-error" role="alert">{erroEnvioEmail}</div>
            )}
            <div className="inbox-compose-row is-email">
              <textarea
                value={textoEmail}
                onChange={e => setTextoEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarEmail() } }}
                placeholder="Digite a resposta..."
                rows={1}
                aria-label="Resposta por email"
              />
              <button
                onClick={enviarEmail}
                disabled={!textoEmail.trim() || enviandoEmail}
                className="inbox-send-button"
                aria-label="Enviar resposta por email"
              >
                {enviandoEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </footer>
        </section>
      )}
      </>)}

      {mostrarNovaMsgEmail && (
        <div className="new-email-backdrop">
          <div className="new-email-dialog" role="dialog" aria-modal="true" aria-labelledby="new-email-title" aria-describedby="new-email-description">
            <div className="new-email-heading">
              <div>
                <span>Compor email</span>
                <h3 id="new-email-title">Nova mensagem</h3>
              </div>
              <button onClick={() => setMostrarNovaMsgEmail(false)} aria-label="Fechar nova mensagem">
                <IconX size={16} />
              </button>
            </div>
            <p id="new-email-description" className="new-email-description">
              Envia um email do zero pra qualquer endereço, mesmo que nunca tenha trocado mensagem antes (útil pra prospecção manual).
            </p>
            {erroNovaMsg && (
              <div className="inbox-error" role="alert">{erroNovaMsg}</div>
            )}
            <label className="new-email-label" htmlFor="new-email-to">Para</label>
            <input
              id="new-email-to"
              type="email"
              value={novaMsgPara}
              onChange={e => setNovaMsgPara(e.target.value)}
              placeholder="email@exemplo.com"
            />
            <label className="new-email-label" htmlFor="new-email-subject">Assunto</label>
            <input
              id="new-email-subject"
              type="text"
              value={novaMsgAssunto}
              onChange={e => setNovaMsgAssunto(e.target.value)}
              placeholder="Assunto do email"
            />
            <label className="new-email-label" htmlFor="new-email-body">Mensagem</label>
            <textarea
              id="new-email-body"
              value={novaMsgTexto}
              onChange={e => setNovaMsgTexto(e.target.value)}
              placeholder="Digite a mensagem..."
              rows={6}
            />
            <div className="new-email-actions">
              <button
                onClick={() => setMostrarNovaMsgEmail(false)}
                className="new-email-cancel"
              >
                Cancelar
              </button>
              <button
                onClick={enviarNovaMensagemEmail}
                disabled={!novaMsgPara.trim() || !novaMsgAssunto.trim() || !novaMsgTexto.trim() || enviandoNovaMsg}
                className="new-email-submit"
              >
                {enviandoNovaMsg ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
