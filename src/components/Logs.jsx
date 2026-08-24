import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { useTheme } from '../App.jsx'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { IconSearch, IconX } from './Icons.jsx'
import { STATUS_CONFIG } from '../constants.js'

const PER_PAGE = 25

const ACAO_CONFIG = {
  criar:     { label: 'Criar',     color: '#059669', bg: '#ECFDF5', darkBg: '#052e1630', darkColor: '#34d399' },
  atualizar: { label: 'Atualizar', color: '#2563EB', bg: '#EFF6FF', darkBg: '#1e3a8a30', darkColor: '#60a5fa' },
  deletar:   { label: 'Deletar',   color: '#B91C1C', bg: '#FEF2F2', darkBg: '#450a0a30', darkColor: '#f87171' },
  concluir:  { label: 'Concluir',  color: '#7C3AED', bg: '#F5F3FF', darkBg: '#3b0764 30', darkColor: '#a78bfa' },
  reabrir:   { label: 'Reabrir',   color: '#0891B2', bg: '#ECFEFF', darkBg: '#0c4a6e30', darkColor: '#38bdf8' },
  enviar:    { label: 'Enviar',    color: '#C2410C', bg: '#FFF7ED', darkBg: '#43140330', darkColor: '#fb923c' },
  pausar:    { label: 'Pausar',    color: '#92740C', bg: '#FFFBEB', darkBg: '#42330630', darkColor: '#fbbf24' },
  receber:   { label: 'Receber',   color: '#15803D', bg: '#F0FDF4', darkBg: '#052e1630', darkColor: '#4ade80' },
  buscar:    { label: 'Buscar',    color: '#4338CA', bg: '#EEF2FF', darkBg: '#1e1b4b30', darkColor: '#818cf8' },
}

const TABELA_LABELS = {
  leads:                          'Leads',
  empresas:                       'Leads',
  contratos:                      'Contratos',
  tasks:                          'Tarefas',
  pacotes:                        'Serviços',
  perfil:                         'Perfil',
  users:                          'Usuários',
  scripts:                        'Scripts',
  email_automations:              'Email Marketing',
  email_automation_enrollments:   'Email Marketing',
  email_conversas_mensagens:      'Email',
  formularios:                    'Formulários',
  whatsapp_messages:              'WhatsApp',
}

// Origens "Sistema" (webhooks/automações sem usuário logado disparando a
// ação) — usadas pra exibir um selo visual diferente de ações de usuário.
const ORIGENS_SISTEMA = ['Sistema', 'Webhook Casa dos Dados', 'Sincronização de Email (IMAP)', 'Webhook WhatsApp']

const PERIOD_OPTIONS = [
  { value: 'today',   label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d',      label: 'Últimos 7 dias' },
  { value: '30d',     label: 'Últimos 30 dias' },
  { value: 'all',     label: 'Todos' },
  { value: 'custom',  label: 'Personalizado' },
]

function periodToRange(period, customFrom, customTo) {
  const now = new Date()
  if (period === 'today')     return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
  if (period === 'yesterday') { const y = subDays(now, 1); return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() } }
  if (period === '7d')        return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() }
  if (period === '30d')       return { from: startOfDay(subDays(now, 29)).toISOString(), to: endOfDay(now).toISOString() }
  if (period === 'custom')    return { from: customFrom ? new Date(customFrom).toISOString() : null, to: customTo ? endOfDay(new Date(customTo)).toISOString() : null }
  return { from: null, to: null }
}

function fmtDetalhes(detalhes) {
  if (!detalhes) return '—'
  if (typeof detalhes === 'string') return detalhes.slice(0, 120)
  const d = detalhes
  if (d.title)          return `"${d.title}"${d.empresa_nome ? ` · ${d.empresa_nome}` : ''}${d.due_date ? ` · ${d.due_date}` : ''}`
  if (d.titulo)         return d.titulo
  if (d.nome_fantasia)  return d.nome_fantasia
  if (d.razao_social)   return d.razao_social
  if (d.cliente_nome)   return d.cliente_nome
  if (d.destinatario_email) return `Para: ${d.destinatario_email}${d.assunto ? ` · "${d.assunto}"` : ''}`
  if (d.termo !== undefined || d.status || d.etiqueta || d.cnae) {
    const partes = [d.termo && `"${d.termo}"`, d.status && `status: ${d.status}`, d.etiqueta && `etiqueta: ${d.etiqueta}`, d.cnae?.length && `${d.cnae.length} CNAE(s)`].filter(Boolean)
    return partes.join(' · ') || 'sem filtros'
  }
  if (d.tipo === 'pessoa' && d.nome) return [d.nome, d.sobrenome].filter(Boolean).join(' ')
  if (d.nome && d.sobrenome) return `${d.nome} ${d.sobrenome}`
  if (d.nome)           return d.nome
  if (d.status_prospeccao) return `Status → ${STATUS_CONFIG[d.status_prospeccao]?.label || d.status_prospeccao}`
  if (d.comissao_status)   return `Comissão: ${d.comissao_status}`
  if (d.count != null)     return `${d.count} registros`
  const entries = Object.entries(d).filter(([, v]) => v != null && v !== '').slice(0, 3)
  return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? '…' : String(v).slice(0, 40)}`).join(' · ') || '—'
}

function fmtFieldValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'status_prospeccao') return STATUS_CONFIG[value]?.label || value
  if (typeof value === 'boolean')  return value ? 'Sim' : 'Não'
  if (typeof value === 'object')   return JSON.stringify(value).slice(0, 80)
  return String(value).slice(0, 120)
}

const FIELD_LABELS = {
  status_prospeccao: 'Status',
  canal_envio:       'Canal',
  observacoes:       'Observações',
  vendedor_id:       'Vendedor (ID)',
  vendedor_nome:     'Vendedor',
  tags:              'Etiquetas',
  comissao_status:   'Status comissão',
  comissao_paga_em:  'Comissão paga em',
  comprovante_url:   'Comprovante',
  nome_fantasia:     'Nome fantasia',
  razao_social:      'Razão social',
  tipo:              'Tipo',
  telefone:          'Telefone',
  email:             'E-mail',
  municipio:         'Município',
  uf:                'UF',
  origem:            'Origem',
  cnpj:              'CNPJ',
  nome:              'Nome',
  titulo:            'Título',
  assunto:           'Assunto',
  destinatario_email: 'Destinatário',
  remetente:         'Remetente',
  motivo:            'Motivo',
  session_id:        'Conversa (WhatsApp)',
  conteudo:          'Conteúdo',
  gerado_por_ia:     'Gerado por IA',
  matriculados:      'Matriculados',
  steps:             'Etapas',
  ativo:             'Ativo',
  termo:             'Termo buscado',
  etiqueta:          'Etiqueta',
  cnae:              'CNAE',
}

function DetalhesExpanded({ detalhes, acao }) {
  if (!detalhes || typeof detalhes !== 'object') {
    return <span style={{ fontSize: 12, color: 'var(--text3)' }}>{detalhes || '—'}</span>
  }
  const entries = Object.entries(detalhes).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) return <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sem detalhes</span>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 130, flexShrink: 0, paddingTop: 1 }}>
            {FIELD_LABELS[k] || k}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text2)', wordBreak: 'break-word', flex: 1 }}>
            {fmtFieldValue(k, v)}
          </span>
        </div>
      ))}
    </div>
  )
}

function AcaoBadge({ acao, theme }) {
  const cfg = ACAO_CONFIG[acao] || { label: acao, color: 'var(--text3)', bg: 'var(--bg3)', darkBg: 'var(--bg3)', darkColor: 'var(--text3)' }
  const bg    = theme === 'dark' ? cfg.darkBg    : cfg.bg
  const color = theme === 'dark' ? cfg.darkColor : cfg.color
  return (
    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

export default function Logs({ isSuperAdmin }) {
  const isMobile = useIsMobile()
  const theme    = useTheme()
  const [logs, setLogs]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [totalCount, setTotalCount]   = useState(0)
  const [filterUsuario, setFilterUsuario] = useState('')
  const [filterAcao, setFilterAcao]   = useState('')
  const [filterTabela, setFilterTabela] = useState('')
  const [searchText, setSearchText]   = useState('')
  const [period, setPeriod]           = useState('30d')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [usuarios, setUsuarios]       = useState([])
  const [expandedId, setExpandedId]   = useState(null)
  const [stats, setStats]             = useState({ today: 0, week: 0, topUser: '' })

  const range = useMemo(() => periodToRange(period, customFrom, customTo), [period, customFrom, customTo])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * PER_PAGE
    const to   = from + PER_PAGE - 1

    let q = supabase.from('logs').select('*', { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(from, to)

    if (filterUsuario) q = q.eq('usuario_nome', filterUsuario)
    if (filterAcao)    q = q.eq('acao', filterAcao)
    if (filterTabela)  q = q.eq('tabela', filterTabela)
    if (searchText)    q = q.ilike('detalhes::text', `%${searchText}%`)
    if (range.from)    q = q.gte('criado_em', range.from)
    if (range.to)      q = q.lte('criado_em', range.to)

    const { data, error, count } = await q
    if (!error) { setLogs(data || []); setTotalCount(count || 0) }
    setLoading(false)
  }, [page, filterUsuario, filterAcao, filterTabela, searchText, range])

  // Stats
  useEffect(() => {
    async function fetchStats() {
      const todayStart = startOfDay(new Date()).toISOString()
      const weekStart  = startOfDay(subDays(new Date(), 6)).toISOString()

      const [todayRes, weekRes] = await Promise.all([
        supabase.from('logs').select('id', { count: 'exact', head: true }).gte('criado_em', todayStart),
        supabase.from('logs').select('usuario_nome').gte('criado_em', weekStart),
      ])

      const weekLogs = weekRes.data || []
      const userCounts = {}
      weekLogs.forEach(l => { if (l.usuario_nome) userCounts[l.usuario_nome] = (userCounts[l.usuario_nome] || 0) + 1 })
      const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

      setStats({ today: todayRes.count || 0, week: weekLogs.length, topUser })
    }
    fetchStats()
  }, [])

  // Users list
  useEffect(() => {
    supabase.from('logs').select('usuario_nome').then(({ data }) => {
      if (data) setUsuarios([...new Set(data.map(d => d.usuario_nome).filter(Boolean))])
    })
  }, [])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [filterUsuario, filterAcao, filterTabela, searchText, period, customFrom, customTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Real-time: new logs appear immediately
  useEffect(() => {
    const ch = supabase.channel('logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
        fetchLogs()
        setStats(s => ({ ...s, today: s.today + 1, week: s.week + 1 }))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchLogs])

  if (!isSuperAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🔒</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Acesso restrito</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Esta seção é visível apenas para superadmin.</div>
        </div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const inputStyle = { padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }

  return (
    <div className="workspace-screen logs-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div className="workspace-toolbar" style={{ padding: isMobile ? '12px 16px 10px' : '20px 32px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>

        {/* Title + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <h1 className="workspace-heading" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: 'var(--text)' }}>Logs</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
            {totalCount} registros
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 20 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{stats.today}</span> ações hoje
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 20 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{stats.week}</span> esta semana
            </span>
            {stats.topUser && (
              <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 20 }}>
                Mais ativo: <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{stats.topUser}</span>
              </span>
            )}
          </div>
        </div>

        {/* Filters row 1 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <input
              type="text"
              placeholder="Buscar nos detalhes..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ ...inputStyle, width: '100%', paddingLeft: 34, boxSizing: 'border-box', cursor: 'text' }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
              <IconSearch size={14} color="var(--text3)" />
            </span>
            {searchText && (
              <button onClick={() => setSearchText('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
                <IconX size={13} color="var(--text3)" />
              </button>
            )}
          </div>

          {/* Período */}
          <select value={period} onChange={e => setPeriod(e.target.value)} style={inputStyle}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Usuário */}
          <select value={filterUsuario} onChange={e => setFilterUsuario(e.target.value)} style={inputStyle}>
            <option value="">Todos os usuários</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* Ação */}
          <select value={filterAcao} onChange={e => setFilterAcao(e.target.value)} style={inputStyle}>
            <option value="">Todas as ações</option>
            {Object.entries(ACAO_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          {/* Tabela */}
          <select value={filterTabela} onChange={e => setFilterTabela(e.target.value)} style={inputStyle}>
            <option value="">Todas as áreas</option>
            {Object.entries(TABELA_LABELS).filter(([k]) => k !== 'empresas').map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>De</label>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...inputStyle, cursor: 'text' }} />
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>até</label>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...inputStyle, cursor: 'text' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="workspace-content logs-content" style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', padding: isMobile ? '12px 12px 16px' : '14px 32px 20px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Nenhum log encontrado</div>
        ) : isMobile ? (
          // Mobile: cards
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map(log => {
              const expanded = expandedId === log.id
              return (
                <div
                  key={log.id}
                  className="card"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  style={{ padding: '11px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AcaoBadge acao={log.acao} theme={theme} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 20 }}>
                      {TABELA_LABELS[log.tabela] || log.tabela || '—'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {log.criado_em ? format(new Date(log.criado_em), 'dd/MM HH:mm') : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>{fmtDetalhes(log.detalhes)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {log.usuario_nome || '—'}
                    {ORIGENS_SISTEMA.includes(log.usuario_nome) && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 4, letterSpacing: 0.3 }}>AUTO</span>
                    )}
                  </div>
                  {expanded && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <DetalhesExpanded detalhes={log.detalhes} acao={log.acao} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          // Desktop: table
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 3px' }}>
            <thead>
              <tr>
                {['Data/Hora', 'Usuário', 'Ação', 'Área', 'Resumo'].map((label, i) => (
                  <th key={label} style={{
                    padding: '5px 12px', textAlign: 'left', fontSize: 11,
                    color: 'var(--text3)', fontWeight: 500, letterSpacing: 0.3,
                    width: [140, 130, 90, 100, undefined][i],
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const expanded = expandedId === log.id
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'var(--bg3)') }}
                      onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'var(--bg2)') }}
                    >
                      <td style={{ padding: '9px 12px', background: 'var(--bg2)', borderRadius: expanded ? '8px 0 0 0' : '8px 0 0 8px', whiteSpace: 'nowrap', transition: 'background 0.1s' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                          {log.criado_em ? format(new Date(log.criado_em), 'dd/MM/yy HH:mm') : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {log.usuario_nome || '—'}
                          {ORIGENS_SISTEMA.includes(log.usuario_nome) && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 4, letterSpacing: 0.3 }}>AUTO</span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                        <AcaoBadge acao={log.acao} theme={theme} />
                      </td>
                      <td style={{ padding: '9px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
                          {TABELA_LABELS[log.tabela] || log.tabela || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', background: 'var(--bg2)', borderRadius: expanded ? '0 8px 0 0' : '0 8px 8px 0', transition: 'background 0.1s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>
                            {fmtDetalhes(log.detalhes)}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, opacity: 0.5 }}>
                            {expanded ? '▴' : '▾'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={5} style={{ padding: '12px 20px 14px', background: 'var(--bg2)', borderRadius: '0 0 8px 8px', borderTop: '1px solid var(--border)' }}>
                          <DetalhesExpanded detalhes={log.detalhes} acao={log.acao} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div style={{ padding: isMobile ? '10px 16px' : '12px 32px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, totalCount)} de {totalCount}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              «
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              ← Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)', padding: '0 6px' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              Próxima →
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
