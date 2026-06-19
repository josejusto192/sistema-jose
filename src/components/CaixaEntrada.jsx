import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase.js'
import { IconInbox, IconWhatsApp, IconSearch, IconCheck, IconPaperclip, IconX } from './Icons.jsx'

// Canais suportados. Por enquanto só o WhatsApp está ativo — Instagram e os
// próximos entram aqui conforme as integrações forem ficando prontas.
const CANAIS = [
  { id: 'whatsapp',  label: 'WhatsApp',  Icon: IconWhatsApp, color: '#25D366', ativo: true },
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
        <a href={m.media_url} target="_blank" rel="noopener noreferrer">
          <img src={m.media_url} alt="" style={{ maxWidth: 240, borderRadius: 8, display: 'block' }} />
        </a>
        {m.content && <div style={{ marginTop: 6 }}>{m.content}</div>}
      </>
    )
  }
  if (m.message_type === 'video') {
    return (
      <>
        <video src={m.media_url} controls style={{ maxWidth: 240, borderRadius: 8, display: 'block' }} />
        {m.content && <div style={{ marginTop: 6 }}>{m.content}</div>}
      </>
    )
  }
  if (m.message_type === 'audio') {
    return <audio src={m.media_url} controls style={{ width: 220 }} />
  }
  return (
    <a href={m.media_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>
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
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)

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
      setErroEnvio(data?.error || error?.message || 'Erro ao enviar mensagem')
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
  const canalAtual = CANAIS.find(c => c.id === canal)

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Coluna: canais + lista de conversas */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
        <div style={{ padding: '18px 18px 12px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Caixa de Entrada</h2>
        </div>

        {/* Abas de canal */}
        <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px' }}>
          {CANAIS.map(c => (
            <button
              key={c.id}
              onClick={() => c.ativo && setCanal(c.id)}
              disabled={!c.ativo}
              title={c.ativo ? c.label : `${c.label} — em breve`}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                background: canal === c.id ? 'var(--accent)' : 'var(--bg3)',
                color: canal === c.id ? '#fff' : c.ativo ? 'var(--text2)' : 'var(--text3)',
                fontSize: 12, fontWeight: 600, cursor: c.ativo ? 'pointer' : 'not-allowed',
                opacity: c.ativo ? 1 : 0.55,
              }}
            >
              <c.Icon size={13} color={canal === c.id ? '#fff' : c.color} />
              {c.label}
              {!c.ativo && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 2 }}>(em breve)</span>}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <IconSearch size={13} color="var(--text3)" />
            </span>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              style={{
                width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Lista de conversas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConversas && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
          )}

          {!loadingConversas && conversasFiltradas.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
              <IconInbox size={36} color="var(--border)" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginTop: 12 }}>Nenhuma conversa ainda</div>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                As conversas do {canalAtual?.label} vão aparecer aqui automaticamente.
              </div>
            </div>
          )}

          {conversasFiltradas.map(c => {
            const nome = c.lead?.nome_fantasia || c.lead?.razao_social || c.session_id
            const ativa = c.session_id === sessionId
            return (
              <button
                key={c.session_id}
                onClick={() => openConversa(c.session_id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
                  padding: '11px 14px', background: ativa ? 'var(--bg3)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  {nome.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: c.nao_lidas > 0 ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nome}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{formatDay(c.ultima_mensagem_em)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: c.nao_lidas > 0 ? 'var(--text2)' : 'var(--text3)', fontWeight: c.nao_lidas > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.ultima_direcao === 'outbound' ? 'Você: ' : ''}{previewMensagem(c)}
                    </span>
                    {c.nao_lidas > 0 && (
                      <span style={{ flexShrink: 0, background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>
                        {c.nao_lidas}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Painel da conversa selecionada */}
      {!sessionId && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <IconWhatsApp size={26} color="#25D366" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Caixa de Entrada do WhatsApp</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
              Selecione uma conversa à esquerda para ver as mensagens e responder direto por aqui.
            </div>
          </div>
        </div>
      )}

      {sessionId && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minWidth: 0 }}>
          {/* Header da conversa */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {conversaAtual?.lead?.nome_fantasia || conversaAtual?.lead?.razao_social || sessionId}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sessionId}</div>
            </div>
            {conversaAtual?.lead && (
              <button
                onClick={() => onOpenLead?.(conversaAtual.lead)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                Ver lead
              </button>
            )}
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingMsgs && <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando mensagens...</div>}
            {!loadingMsgs && mensagens.map(m => {
              const out = m.direction === 'outbound'
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                    background: out ? 'var(--accent)' : 'var(--bg3)',
                    color: out ? '#fff' : 'var(--text)',
                    fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    <MediaBubbleContent m={m} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, opacity: 0.7, justifyContent: 'flex-end' }}>
                      {formatTime(m.created_at)}
                      {out && m.whatsapp_status === 'read' && <IconCheck size={10} color={out ? '#fff' : 'var(--text3)'} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Composição */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            {erroEnvio && (
              <div style={{ marginBottom: 8, fontSize: 12, color: '#DC2626' }}>{erroEnvio}</div>
            )}
            {arquivo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bg3)', fontSize: 12, color: 'var(--text2)', width: 'fit-content' }}>
                <IconPaperclip size={12} color="var(--text3)" />
                {arquivo.name}
                <button onClick={() => { setArquivo(null); if (fileInputRef.current) fileInputRef.current.value = '' }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                  <IconX size={12} color="var(--text3)" />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                style={{ display: 'none' }}
                onChange={e => setArquivo(e.target.files?.[0] || null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
                style={{
                  width: 38, flexShrink: 0, borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconPaperclip size={15} />
              </button>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder={arquivo ? 'Adicionar legenda (opcional)...' : 'Digite uma mensagem...'}
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none',
                  resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', maxHeight: 120,
                }}
              />
              <button
                onClick={enviar}
                disabled={(!texto.trim() && !arquivo) || enviando}
                style={{
                  padding: '0 18px', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: (!texto.trim() && !arquivo) || enviando ? 'default' : 'pointer',
                  opacity: (!texto.trim() && !arquivo) || enviando ? 0.6 : 1,
                }}
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
