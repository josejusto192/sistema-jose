import React, { useState, useEffect } from 'react'
import { STATUS_CONFIG, CANAL_CONFIG, SCRIPTS, CONTRATO_STATUS, PACOTES, leadName } from '../constants.js'
import { useTheme, useIsSuperAdmin } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, parseISO } from 'date-fns'
import { supabase } from '../supabase.js'
import { IconMail, IconPhone, IconCamera, IconFileText, IconWhatsApp, IconCheck, IconCopy, IconX, IconHistory, IconPlus, IconTrash, IconEdit, IconClock } from './Icons.jsx'
import { TASK_TYPES } from './Agenda.jsx'

function parseDate(str) {
  if (!str) return null
  return str.includes('T') ? new Date(str) : parseISO(str + 'T12:00:00')
}

function Field({ label, value, mono }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)' }}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>{title}</div>
      {children}
    </div>
  )
}

const CANAL_ICON_MAP = { whatsapp: IconWhatsApp, instagram: IconCamera, email: IconMail, ligacao: IconPhone }

// Gera uma cor de palette a partir de um hash da string
const TAG_PALETTE = [
  { bg: '#EFF6FF', color: '#2563EB' },
  { bg: '#F0FDF4', color: '#16A34A' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#FDF4FF', color: '#9333EA' },
  { bg: '#FFFBEB', color: '#B45309' },
  { bg: '#FFF1F2', color: '#BE123C' },
  { bg: '#F0FDFA', color: '#0D9488' },
  { bg: '#F8FAFC', color: '#475569' },
]

function tagColor(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffff
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

export default function LeadDetail({ lead, onBack, onUpdate, onCreateContrato, tasks = [], onSaveTask, onDeleteTask, onToggleTask, userId, empresas = [], contratos = [] }) {
  const theme = useTheme()
  const isSuperAdmin = useIsSuperAdmin()
  const isMobile = useIsMobile()
  const [status, setStatus] = useState(lead.status_prospeccao || 'novo')
  const [vendedorId, setVendedorId] = useState(lead.vendedor_id || '')
  const [vendedores, setVendedores] = useState([])
  const [canal, setCanal] = useState(lead.canal_envio || '')
  const [obs, setObs] = useState(lead.observacoes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nota, setNota] = useState('')
  const [notas, setNotas] = useState(() => {
    try { return JSON.parse(lead.observacoes_json || '[]') } catch { return [] }
  })
  const [scriptsCopied, setScriptsCopied] = useState({})
  const [taskModal, setTaskModal] = useState(null) // null | { task? }
  const [taskType, setTaskType] = useState('followup')
  const [taskSaving, setTaskSaving] = useState(false)
  const [scriptsOpen, setScriptsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('dados') // eslint-disable-line

  // Tags state
  const [tags, setTags] = useState(() => lead.tags || [])
  const [tagInput, setTagInput] = useState('')

  // Social fields state
  const [socialForm, setSocialForm] = useState({
    instagram_url: lead.instagram_url || '',
    linkedin_url:  lead.linkedin_url  || '',
    facebook_url:  lead.facebook_url  || '',
    site_url:      lead.site_url      || '',
  })
  const [socialSaving, setSocialSaving] = useState(false)
  const [socialSaved, setSocialSaved]   = useState(false)

  async function saveSocial() {
    setSocialSaving(true)
    await onUpdate(lead.id, {
      instagram_url: socialForm.instagram_url.trim() || null,
      linkedin_url:  socialForm.linkedin_url.trim()  || null,
      facebook_url:  socialForm.facebook_url.trim()  || null,
      site_url:      socialForm.site_url.trim()       || null,
    })
    setSocialSaving(false)
    setSocialSaved(true)
    setTimeout(() => setSocialSaved(false), 2000)
  }

  // Status history
  const [statusHistory, setStatusHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('id, nome, sobrenome').eq('ativo', true)
      .then(({ data }) => setVendedores(data || []))
  }, [])

  async function assignVendedor(newId) {
    setVendedorId(newId)
    const prof = vendedores.find(v => v.id === newId)
    const nome = prof ? [prof.nome, prof.sobrenome].filter(Boolean).join(' ') : ''
    await onUpdate(lead.id, { vendedor_id: newId || null, vendedor_nome: nome || null })
  }

  useEffect(() => {
    async function fetchHistory() {
      setHistoryLoading(true)
      const { data } = await supabase
        .from('status_history')
        .select('*')
        .eq('empresa_id', lead.id)
        .order('criado_em', { ascending: false })
      setStatusHistory(data || [])
      setHistoryLoading(false)
    }
    fetchHistory()
  }, [lead.id])

  useEffect(() => {
    if (taskModal !== null) setTaskType(taskModal.task?.type || 'followup')
  }, [taskModal])

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.novo
  const badgeStyle = theme === 'dark'
    ? { background: cfg.darkBg, color: cfg.darkColor }
    : { background: cfg.bg, color: cfg.color }

  const nomeDisplay = leadName(lead)

  async function save() {
    setSaving(true)
    const updates = {
      status_prospeccao: status,
      canal_envio: canal,
      observacoes: obs,
    }
    if (status !== lead.status_prospeccao && !lead.data_envio) {
      updates.data_envio = new Date().toISOString()
    }
    await onUpdate(lead.id, updates)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addNota() {
    if (!nota.trim()) return
    const nova = { texto: nota, data: new Date().toISOString() }
    const updated = [...notas, nova]
    setNotas(updated)
    setNota('')
    onUpdate(lead.id, { observacoes_json: JSON.stringify(updated) })
  }

  function copyScript(script) {
    const texto = script.texto
      .replace(/\[Nome\]/g, nomeDisplay)
      .replace(/\[Empresa\]/g, nomeDisplay)
    navigator.clipboard.writeText(texto).then(() => {
      setScriptsCopied(prev => ({ ...prev, [script.id]: true }))
      setTimeout(() => setScriptsCopied(prev => ({ ...prev, [script.id]: false })), 2000)
    })
  }

  function addTag() {
    const t = tagInput.trim()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    const updated = [...tags, t]
    setTags(updated)
    setTagInput('')
    onUpdate(lead.id, { tags: updated })
  }

  function removeTag(tag) {
    const updated = tags.filter(t => t !== tag)
    setTags(updated)
    onUpdate(lead.id, { tags: updated })
  }

  const cnpjFormatado = lead.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  const telefoneLink = lead.telefone ? `https://wa.me/55${lead.telefone.replace(/\D/g, '')}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: isMobile ? '12px 16px' : '18px 32px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', zIndex: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Voltar para leads
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
              {nomeDisplay}
            </h1>
            {lead.tipo !== 'pessoa' && lead.nome_fantasia && lead.razao_social && (
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{lead.razao_social}</div>
            )}
            <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="badge" style={badgeStyle}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot }} />
                {cfg.label}
              </span>
              {lead.tipo === 'pessoa'
                ? <span className="badge" style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>👤 Pessoa</span>
                : <span className="badge" style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>🏢 Empresa</span>
              }
              {lead.tipo !== 'pessoa' && lead.eh_mei && <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>MEI</span>}
              {lead.tipo !== 'pessoa' && lead.optante_simples && <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>Simples Nacional</span>}
              {lead.tipo !== 'pessoa' && lead.matriz_filial && <span className="badge" style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>{lead.matriz_filial}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {status === 'fechou' && onCreateContrato && (
              <button
                onClick={() => onCreateContrato(lead)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <IconFileText size={14} color="#fff" /> Criar contrato
              </button>
            )}
            {lead.telefone && (
              <a href={telefoneLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 8, color: 'var(--green)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                <IconWhatsApp size={14} color="var(--green)" /> WhatsApp
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, textDecoration: 'none' }}>
                <IconMail size={14} color="var(--text2)" /> E-mail
              </a>
            )}
          </div>
        </div>
      </div>


      {/* Content */}
      <div style={{ padding: isMobile ? '12px 16px' : '20px 32px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 16, flex: 1, background: 'var(--bg)', overflow: 'auto' }}>
        {/* Coluna esquerda */}
        <div>
          {lead.tipo !== 'pessoa' && (
            <Section title="Dados cadastrais">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="CNPJ" value={cnpjFormatado} mono />
                <Field label="CNPJ Raiz" value={lead.cnpj_raiz} mono />
                <Field label="Natureza jurídica" value={lead.natureza_juridica_descricao} />
                <Field label="Porte" value={lead.porte_descricao} />
                <Field label="Data de abertura" value={lead.data_abertura ? format(parseDate(lead.data_abertura), 'dd/MM/yyyy') : null} />
                <Field label="Situação" value={lead.situacao_cadastral} />
                <Field label="Capital social" value={lead.capital_social ? `R$ ${Number(lead.capital_social).toLocaleString('pt-BR')}` : null} />
                <Field label="Captado em" value={lead.criado_em ? format(new Date(lead.criado_em), "dd/MM/yyyy 'às' HH:mm") : null} />
              </div>
            </Section>
          )}
          {lead.tipo === 'pessoa' && (
            <Section title="Dados">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Field label="Nome" value={lead.nome} />
                <Field label="Sobrenome" value={lead.sobrenome} />
                <Field label="Captado em" value={lead.criado_em ? format(new Date(lead.criado_em), "dd/MM/yyyy 'às' HH:mm") : null} />
              </div>
            </Section>
          )}

          {lead.tipo !== 'pessoa' && (
            <Section title="Atividade econômica">
              <Field label="CNAE Principal" value={lead.cnae_principal_descricao ? `${lead.cnae_principal_codigo} — ${lead.cnae_principal_descricao}` : null} />
              {lead.cnaes_secundarios?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>CNAEs secundários</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {lead.cnaes_secundarios.slice(0, 5).map((c, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text3)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{c.codigo}</span> — {c.descricao}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section title="Localização">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Logradouro" value={[lead.tipo_logradouro, lead.logradouro, lead.numero].filter(Boolean).join(' ')} />
              <Field label="Bairro" value={lead.bairro} />
              <Field label="Município" value={lead.municipio} />
              <Field label="UF" value={lead.uf} />
              <Field label="CEP" value={lead.cep} mono />
            </div>
            {lead.latitude && lead.longitude && (
              <a href={`https://maps.google.com/?q=${lead.latitude},${lead.longitude}`} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                📍 Ver no Maps
              </a>
            )}
          </Section>

          <Section title="Contato">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="E-mail" value={lead.email} />
              {lead.tipo !== 'pessoa' && <Field label="Válido" value={lead.email_valido != null ? (lead.email_valido ? 'Sim' : 'Não') : null} />}
              <Field label="Telefone" value={lead.telefone} mono />
              {lead.tipo !== 'pessoa' && <Field label="DDD / Tipo" value={lead.telefone_ddd ? `${lead.telefone_ddd} · ${lead.telefone_tipo || ''}` : null} />}
            </div>
          </Section>

          {/* Presença online */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Presença online</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 12 }}>
              {[
                { key: 'instagram_url', label: 'Instagram', placeholder: 'https://instagram.com/...' },
                { key: 'linkedin_url',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/...' },
                { key: 'facebook_url',  label: 'Facebook',  placeholder: 'https://facebook.com/...' },
                { key: 'site_url',      label: 'Site',      placeholder: 'https://...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={socialForm[key]}
                      onChange={e => setSocialForm(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ flex: 1, padding: '6px 9px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}
                    />
                    {socialForm[key] && (
                      <a href={socialForm[key]} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveSocial}
              disabled={socialSaving}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: socialSaved ? 'var(--green-bg)' : 'var(--accent)', color: socialSaved ? 'var(--green)' : '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: socialSaving ? 0.6 : 1, transition: 'background 0.2s' }}
            >
              {socialSaved ? '✓ Salvo' : socialSaving ? 'Salvando...' : 'Salvar links'}
            </button>
          </div>

          {lead.tipo !== 'pessoa' && lead.quadro_societario?.length > 0 && (
            <Section title={`Quadro societário (${lead.quadro_societario.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lead.quadro_societario.map((s, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{s.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.qualificacao_socio} · {s.faixa_etaria_descricao}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                      {s.data_entrada_sociedade ? format(parseDate(s.data_entrada_sociedade), 'dd/MM/yyyy') : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Scripts de abordagem */}
          <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setScriptsOpen(o => !o)}
              style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Scripts de abordagem</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', transition: 'transform 0.2s', display: 'inline-block', transform: scriptsOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {scriptsOpen && (
              <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, marginTop: 12 }}>
                  Clique em copiar — [Nome] e [Empresa] são substituídos automaticamente por <strong>{nomeDisplay}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {SCRIPTS.map(script => (
                    <div key={script.id} style={{ background: 'var(--bg3)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {(() => { const Ic = CANAL_ICON_MAP[script.canal]; return Ic ? <Ic size={13} color="var(--text3)" /> : null })()}
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>{script.titulo}</span>
                        </div>
                        <button
                          onClick={() => copyScript(script)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                            background: scriptsCopied[script.id] ? 'var(--green-bg)' : 'var(--accent)',
                            color: scriptsCopied[script.id] ? 'var(--green)' : '#fff',
                            transition: 'all 0.2s',
                          }}
                        >
                          {scriptsCopied[script.id]
                            ? <><IconCheck size={12} color="var(--green)" /> Copiado!</>
                            : <><IconCopy size={12} color="#fff" /> Copiar</>
                          }
                        </button>
                      </div>
                      <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                        {script.texto.replace(/\[Nome\]/g, nomeDisplay).replace(/\[Empresa\]/g, nomeDisplay)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita — CRM */}
        <div>
          <div className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>CRM</div>

            {/* Responsável */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Responsável</label>
              {isSuperAdmin ? (
                <select
                  value={vendedorId}
                  onChange={e => assignVendedor(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: vendedorId ? 'var(--text)' : 'var(--text3)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">— Não atribuído —</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>
                      {[v.nome, v.sobrenome].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: lead.vendedor_nome ? 'var(--text)' : 'var(--text3)' }}>
                  {lead.vendedor_nome || 'Não atribuído'}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: badgeStyle.background, border: `1px solid ${cfg.dot}40`, borderRadius: 8, color: badgeStyle.color, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                {Object.entries(STATUS_CONFIG).map(([key, c]) => (
                  <option key={key} value={key} style={{ background: 'var(--bg2)', color: 'var(--text)' }}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Canal de contato</label>
              <select value={canal} onChange={e => setCanal(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, outline: 'none' }}>
                <option value="">Selecionar canal</option>
                {Object.entries(CANAL_CONFIG).map(([key, c]) => (
                  <option key={key} value={key}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Tarefas vinculadas */}
            {onSaveTask && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Tarefas ({tasks.length})</label>
                  <button
                    type="button"
                    onClick={() => setTaskModal({ task: { empresa_id: lead.id, empresa_nome: leadName(lead), due_date: '' } })}
                    style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                  >
                    <IconPlus size={11} color="var(--accent)" /> Nova tarefa
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 0', textAlign: 'center' }}>Nenhuma tarefa ainda</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {tasks.sort((a, b) => {
                      if (a.completed !== b.completed) return a.completed ? 1 : -1
                      return a.due_date.localeCompare(b.due_date)
                    }).map(t => {
                      const cfg = TASK_TYPES[t.type] || TASK_TYPES.tarefa
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, opacity: t.completed ? 0.55 : 1 }}>
                          <button
                            onClick={() => onToggleTask(t)}
                            style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${t.completed ? cfg.dot : 'var(--border)'}`, background: t.completed ? cfg.dot : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}
                          >
                            {t.completed && <IconCheck size={9} color="#fff" />}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none', fontWeight: 500 }}>{t.title}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{t.due_date}{t.due_time ? ` às ${t.due_time.slice(0,5)}` : ''}</span>
                            </div>
                            {t.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.notes}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => setTaskModal({ task: t })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text3)', display: 'flex' }}><IconEdit size={11} color="var(--text3)" /></button>
                            <button onClick={() => onDeleteTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text3)', display: 'flex' }}><IconTrash size={11} color="var(--text3)" /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Observações</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} rows={4} placeholder="Notas sobre este lead..."
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            <button onClick={save} disabled={saving} style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: saved ? 'var(--green-bg)' : 'var(--accent)', color: saved ? 'var(--green)' : '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', outline: saved ? '1px solid var(--green)' : 'none' }}>
              {saving ? 'Salvando...' : saved
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCheck size={13} color="var(--green)" /> Salvo!</span>
                : 'Salvar alterações'
              }
            </button>

            {lead.data_envio && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                Contatado em {format(new Date(lead.data_envio), 'dd/MM/yyyy')}
              </div>
            )}
          </div>

          {/* Contratos */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Contratos {contratos.length > 0 && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>({contratos.length})</span>}
              </span>
              {status === 'fechou' && onCreateContrato && (
                <button
                  onClick={() => onCreateContrato(lead)}
                  style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontWeight: 500 }}
                >
                  <IconPlus size={11} color="var(--accent)" /> Novo
                </button>
              )}
            </div>

            {contratos.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>
                {status === 'fechou' ? 'Nenhum contrato ainda.' : 'Nenhum contrato.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {contratos.map(c => {
                  const cst = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo
                  const pkg = PACOTES[c.pacote]
                  const valor = c.valor_mensal > 0 ? c.valor_mensal : c.valor_total
                  const valorLabel = c.valor_mensal > 0 ? '/mês' : ''
                  return (
                    <div key={c.id} style={{ padding: '10px 11px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pkg?.label || c.pacote || 'Contrato'}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap',
                          background: theme === 'dark' ? cst.darkBg : cst.bg,
                          color: theme === 'dark' ? cst.darkColor : cst.color,
                        }}>
                          {cst.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {valor > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                            R$ {Number(valor).toLocaleString('pt-BR')}{valorLabel}
                          </span>
                        )}
                        {c.data_assinatura && (
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                            {format(parseDate(c.data_assinatura), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                      {c.comissao_valor > 0 && (
                        <div style={{ marginTop: 4, fontSize: 10, color: c.comissao_status === 'paga' ? 'var(--green)' : 'var(--text3)' }}>
                          Comissão R$ {Number(c.comissao_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {c.comissao_status === 'paga' ? 'Paga ✓' : 'Pendente'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Etiquetas */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Etiquetas</div>

            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {tags.map(tag => {
                  const tc = tagColor(tag)
                  return (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: tc.bg, color: tc.color }}>
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: tc.color, lineHeight: 1 }}
                      >
                        <IconX size={10} color={tc.color} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Nova etiqueta..."
                style={{ flex: 1, padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' }}
              />
              <button
                onClick={addTag}
                style={{ padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Histórico de status */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <IconHistory size={14} color="var(--text3)" /> Histórico de status
            </div>

            {historyLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>Carregando...</div>
            ) : statusHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>Sem alterações de status</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {statusHistory.map((s, i) => {
                  const cfgNovo = STATUS_CONFIG[s.status_novo]
                  return (
                    <div key={s.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfgNovo?.dot || 'var(--text3)', flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                          {cfgNovo?.label || s.status_novo}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {s.criado_em ? format(new Date(s.criado_em), "dd/MM/yy 'às' HH:mm") : ''}
                          {s.usuario_nome ? ` · ${s.usuario_nome}` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Histórico / Notas</div>

            {notas.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '14px 0' }}>Nenhuma nota ainda</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {notas.map((n, i) => (
                <div key={i} style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, borderLeft: '2px solid var(--accent)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                    {format(new Date(n.data), "dd/MM 'às' HH:mm")}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{n.texto}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={nota} onChange={e => setNota(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNota()} placeholder="Adicionar nota..."
                style={{ flex: 1, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              <button onClick={addNota} style={{ padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Task modal */}
      {taskModal !== null && onSaveTask && (
        <div
          onClick={() => setTaskModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 420, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {taskModal.task?.id ? 'Editar tarefa' : 'Nova tarefa'}
              </h3>
              <button onClick={() => setTaskModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <IconX size={17} color="var(--text3)" />
              </button>
            </div>
            <form
              onSubmit={async e => {
                e.preventDefault()
                const f = taskModal.task?.id
                  ? { ...taskModal.task }
                  : { ...taskModal.task, user_id: userId }
                const tf = new FormData(e.target)
                setTaskSaving(true)
                await onSaveTask({
                  ...f,
                  title: tf.get('title'),
                  type: tf.get('type'),
                  due_date: tf.get('due_date'),
                  due_time: tf.get('due_time') || null,
                  notes: tf.get('notes') || null,
                })
                setTaskSaving(false)
                setTaskModal(null)
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Título *</label>
                <input name="title" defaultValue={taskModal.task?.title || ''} required autoFocus placeholder="Ex: Ligar para confirmar proposta"
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {Object.entries(TASK_TYPES).map(([key, cfg]) => {
                    const active = taskType === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTaskType(key)}
                        style={{
                          padding: '5px 11px', borderRadius: 20, border: `1px solid ${active ? cfg.dot + '90' : 'var(--border)'}`,
                          fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          background: active ? (theme === 'dark' ? cfg.darkBg : cfg.bg) : 'transparent',
                          color: active ? (theme === 'dark' ? cfg.darkColor : cfg.color) : 'var(--text3)',
                          fontWeight: active ? 600 : 400,
                          transition: 'all 0.12s',
                        }}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    )
                  })}
                  <input type="hidden" name="type" value={taskType} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Data *</label>
                  <input name="due_date" type="date" defaultValue={taskModal.task?.due_date || ''} required
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: 110 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Hora</label>
                  <input name="due_time" type="time" defaultValue={taskModal.task?.due_time || ''}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Notas</label>
                <textarea name="notes" defaultValue={taskModal.task?.notes || ''} rows={2} placeholder="Detalhes adicionais..."
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setTaskModal(null)}
                  style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={taskSaving}
                  style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#00CB53', color: '#fff', fontSize: 12, fontWeight: 600, cursor: taskSaving ? 'not-allowed' : 'pointer', opacity: taskSaving ? 0.7 : 1 }}>
                  {taskSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
