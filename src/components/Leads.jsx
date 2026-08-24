import React, { useState, useMemo, useEffect, useRef } from 'react'
import { STATUS_CONFIG, leadName } from '../constants.js'
import { useTheme, useIsSuperAdmin } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, parseISO } from 'date-fns'
import { IconSearch, IconClock, IconMail, IconPhone, IconInbox, IconList, IconKanban, IconX, IconDownload } from './Icons.jsx'
import { exportLeads } from '../lib/exportLeads.js'
import CnaeFilter from './CnaeFilter.jsx'
import '../styles/sales.css'

const PER_PAGE = 20

const KANBAN_STATUSES = [
  'novo', 'contatado', 'aguardando', 'respondeu',
  'call_agendada', 'proposta_enviada', 'fechou', 'perdido',
]

function hasOverdueTask(leadId, tasks) {
  const today = new Date().toISOString().slice(0, 10)
  return tasks.some(t => t.empresa_id === leadId && !t.completed && t.due_date <= today)
}

// Evita bug de timezone: datas YYYY-MM-DD são UTC; adicionar hora local
function parseDate(str) {
  if (!str) return null
  return str.includes('T') ? new Date(str) : parseISO(str + 'T12:00:00')
}

function StatusBadge({ status }) {
  const theme = useTheme()
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.novo
  const style = theme === 'dark'
    ? { background: cfg.darkBg, color: cfg.darkColor }
    : { background: cfg.bg, color: cfg.color }
  return (
    <span className="badge" style={style}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

const SORT_COLS = {
  nome:        (a, b) => leadName(a).localeCompare(leadName(b)),
  municipio:   (a, b) => (a.municipio || '').localeCompare(b.municipio || ''),
  abertura:    (a, b) => (a.data_abertura || '').localeCompare(b.data_abertura || ''),
  status:      (a, b) => (a.status_prospeccao || '').localeCompare(b.status_prospeccao || ''),
  criado_em:   (a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''),
}

function SortHeader({ label, col, sortField, sortDir, onSort, style: extraStyle }) {
  const active = sortField === col
  return (
    <th
      onClick={() => onSort(col)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSort(col)
        }
      }}
      className={active ? 'is-active' : ''}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      tabIndex={0}
      style={{
        padding: '6px 12px', textAlign: 'left', fontSize: 11, color: active ? 'var(--accent)' : 'var(--text3)',
        fontWeight: active ? 600 : 500, letterSpacing: 0.3, cursor: 'pointer', userSelect: 'none',
        whiteSpace: 'nowrap', ...extraStyle,
      }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  )
}

// Gera cor de tag a partir de hash da string
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

/* ─── Kanban card ──────────────────────────────────────────────────────────── */
function KanbanCard({ empresa: e, onOpen, onDragStart, onDragEnd, isDragging, isSuperAdmin, tasks }) {
  const atencao = hasOverdueTask(e.id, tasks)
  return (
    <article
      className={`sales-kanban-card${isDragging ? ' is-dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(e)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(e)
        }
      }}
      tabIndex={0}
      aria-label={`Abrir lead ${leadName(e)}`}
    >
      <div className="sales-kanban-card__title-row">
        {atencao && (
          <span
            className="sales-attention-dot"
            title="Precisa de atenção"
          />
        )}
        <div className="sales-kanban-card__name">
          {leadName(e)}
        </div>
      </div>

      {e.municipio && (
        <div className="sales-kanban-card__location">
          {e.municipio}{e.uf ? `, ${e.uf}` : ''}
        </div>
      )}

      {e.tags && e.tags.length > 0 && (
        <div className="sales-tag-row">
          {e.tags.slice(0, 2).map(tag => {
            const tc = tagColor(tag)
            return (
              <span key={tag} style={{ padding: '1px 5px', borderRadius: 10, fontSize: 10, background: tc.bg, color: tc.color }}>
                {tag}
              </span>
            )
          })}
          {e.tags.length > 2 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{e.tags.length - 2}</span>
          )}
        </div>
      )}

      {isSuperAdmin && e.vendedor_nome && (
        <div className="sales-kanban-card__owner">
          <span>{e.vendedor_nome}</span>
        </div>
      )}
    </article>
  )
}

/* ─── Kanban board ─────────────────────────────────────────────────────────── */
function KanbanView({ leads, tasks, onOpenLead, onUpdateEmpresa, isSuperAdmin, isMobile }) {
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragCounters = useRef({})

  function handleDrop(status) {
    if (dragId) {
      onUpdateEmpresa(dragId, { status_prospeccao: status })
    }
    setDragId(null)
    setDragOver(null)
    dragCounters.current = {}
  }

  function handleDragEnter(status) {
    dragCounters.current[status] = (dragCounters.current[status] || 0) + 1
    setDragOver(status)
  }

  function handleDragLeave(status) {
    dragCounters.current[status] = (dragCounters.current[status] || 0) - 1
    if (dragCounters.current[status] <= 0) {
      dragCounters.current[status] = 0
      setDragOver(prev => prev === status ? null : prev)
    }
  }

  return (
    <div className={`sales-kanban-board${isMobile ? ' is-mobile' : ''}`} aria-label="Funil de vendas">
      {KANBAN_STATUSES.map(status => {
        const cfg = STATUS_CONFIG[status]
        const columnLeads = leads.filter(e => e.status_prospeccao === status)
        const isOver = dragOver === status && dragId !== null

        return (
          <div
            key={status}
            className={`sales-kanban-column${isOver ? ' is-over' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDragEnter={() => handleDragEnter(status)}
            onDragLeave={() => handleDragLeave(status)}
            onDrop={() => handleDrop(status)}
            style={{ '--status-color': cfg.dot }}
          >
            {/* Column header */}
            <div className="sales-kanban-column__header">
              <div className="sales-kanban-column__heading">
                <span className="sales-kanban-column__dot" style={{ background: cfg.dot }} />
                <span>{cfg.label}</span>
              </div>
              <span className="sales-kanban-column__count">
                {columnLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div className="sales-kanban-column__body">
              {columnLeads.map(e => (
                <KanbanCard
                  key={e.id}
                  empresa={e}
                  tasks={tasks}
                  onOpen={onOpenLead}
                  onDragStart={() => setDragId(e.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); dragCounters.current = {} }}
                  isDragging={dragId === e.id}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
              {columnLeads.length === 0 && (
                <div className="sales-kanban-empty">
                  Solte aqui
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Bulk action bar ──────────────────────────────────────────────────────── */
function BulkBar({ count, onClear, onStatusChange, onAssign, onDelete, vendedores, isSuperAdmin }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleStatus(status) {
    if (!status) return
    setBusy(true)
    await onStatusChange(status)
    setBusy(false)
  }

  async function handleAssign(vendedorId) {
    if (!vendedorId) return
    setBusy(true)
    await onAssign(vendedorId)
    setBusy(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setBusy(true)
    await onDelete()
    setBusy(false)
    setConfirmDelete(false)
  }

  return (
    <div className="sales-bulk-bar" role="region" aria-label="Ações para leads selecionados">
      {/* Count + clear */}
      <span className="sales-bulk-bar__count">
        {count} selecionado{count !== 1 ? 's' : ''}
      </span>
      <button
        onClick={onClear}
        className="sales-bulk-bar__clear"
      >
        Limpar
      </button>

      <div className="sales-bulk-bar__divider" />

      {/* Mudar status */}
      <select
        disabled={busy}
        defaultValue=""
        aria-label="Mudar status dos leads selecionados"
        onChange={e => { handleStatus(e.target.value); e.target.value = '' }}
        className="sales-bulk-bar__select"
      >
        <option value="" disabled>Mudar status…</option>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.label}</option>
        ))}
      </select>

      {/* Atribuir vendedor (superadmin) */}
      {isSuperAdmin && vendedores.length > 0 && (
        <select
          disabled={busy}
          defaultValue=""
          aria-label="Atribuir os leads selecionados a um vendedor"
          onChange={e => { handleAssign(e.target.value); e.target.value = '' }}
          className="sales-bulk-bar__select"
        >
          <option value="" disabled>Atribuir a…</option>
          {vendedores.map(v => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>
      )}

      <div className="sales-bulk-bar__spacer" />

      {/* Excluir */}
      {confirmDelete ? (
        <div className="sales-bulk-bar__confirm">
          <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 500 }}>Excluir {count} lead{count !== 1 ? 's' : ''}?</span>
          <button
            onClick={handleDelete}
            disabled={busy}
            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Excluindo…' : 'Confirmar'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={handleDelete}
          disabled={busy}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #EF444460', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: busy ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          🗑 Excluir
        </button>
      )}
    </div>
  )
}

const ORIGENS = [
  { value: 'manual',    label: 'Manual (app)' },
  { value: 'n8n',       label: 'Automação n8n' },
  { value: 'site',      label: 'Site / formulário' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'outro',     label: 'Outro' },
]

/* ─── New Lead Modal ───────────────────────────────────────────────────────── */
function NewLeadModal({ onClose, onSave }) {
  const [tipo, setTipo] = useState('empresa')
  const [form, setForm] = useState({
    nome_fantasia: '', razao_social: '', cnpj: '',
    nome: '', sobrenome: '',
    telefone: '', email: '',
    municipio: '', uf: '',
    instagram_url: '', linkedin_url: '', facebook_url: '', site_url: '',
    origem: 'manual',
    status_prospeccao: 'novo',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const isEmpresa = tipo === 'empresa'
    if (isEmpresa && !form.nome_fantasia.trim() && !form.razao_social.trim()) {
      setError('Informe ao menos o nome fantasia ou razão social.')
      return
    }
    if (!isEmpresa && !form.nome.trim()) {
      setError('Informe ao menos o nome da pessoa.')
      return
    }
    setSaving(true)
    const payload = {
      tipo,
      telefone:          form.telefone.trim() || null,
      email:             form.email.trim() || null,
      municipio:         form.municipio.trim() || null,
      uf:                form.uf.trim().toUpperCase() || null,
      instagram_url:     form.instagram_url.trim() || null,
      linkedin_url:      form.linkedin_url.trim() || null,
      facebook_url:      form.facebook_url.trim() || null,
      site_url:          form.site_url.trim() || null,
      origem:            form.origem || 'manual',
      status_prospeccao: form.status_prospeccao || 'novo',
    }
    if (isEmpresa) {
      payload.nome_fantasia = form.nome_fantasia.trim() || null
      payload.razao_social  = form.razao_social.trim() || null
      payload.cnpj          = form.cnpj.trim() || null
    } else {
      payload.nome     = form.nome.trim() || null
      payload.sobrenome = form.sobrenome.trim() || null
    }
    const { ok } = await onSave(payload)
    setSaving(false)
    if (ok) onClose()
    else setError('Erro ao criar lead. Tente novamente.')
  }

  const inputStyle = {
    width: '100%', padding: '8px 11px', background: 'var(--bg3)',
    border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'block' }
  const isEmpresa = tipo === 'empresa'

  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
    onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sales-modal sales-new-lead-modal" role="dialog" aria-modal="true" aria-labelledby="new-lead-title">
        {/* Header */}
        <div className="sales-modal__header">
          <div>
            <div className="sales-modal__eyebrow">Cadastro rápido</div>
            <h2 id="new-lead-title" className="sales-modal__title">Novo lead</h2>
          </div>
          <button type="button" onClick={onClose} className="sales-icon-button" aria-label="Fechar cadastro de lead">
            <IconX size={18} color="var(--text3)" />
          </button>
        </div>

        {/* Body — scrollable */}
        <form onSubmit={handleSubmit} className="sales-modal__body">

          {/* Tipo selector */}
          <div className="sales-segmented-control" aria-label="Tipo de lead">
            {[{ value: 'empresa', label: '🏢 Empresa' }, { value: 'pessoa', label: '👤 Pessoa' }].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTipo(opt.value)}
                className={tipo === opt.value ? 'is-active' : ''}
                aria-pressed={tipo === opt.value}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: tipo === opt.value ? 'var(--accent)' : 'var(--bg3)',
                  color: tipo === opt.value ? '#fff' : 'var(--text2)',
                  borderColor: tipo === opt.value ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.12s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="sales-form-grid">

            {/* Campos empresa */}
            {isEmpresa && <>
              <div className="is-full">
                <label style={labelStyle}>Nome fantasia</label>
                <input style={inputStyle} placeholder="Ex: Padaria do João" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} autoFocus />
              </div>
              <div className="is-full">
                <label style={labelStyle}>Razão social</label>
                <input style={inputStyle} placeholder="Ex: João Silva Alimentos ME" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} />
              </div>
              <div className="is-full">
                <label style={labelStyle}>CNPJ</label>
                <input style={inputStyle} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} />
              </div>
            </>}

            {/* Campos pessoa */}
            {!isEmpresa && <>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input style={inputStyle} placeholder="Ex: João" value={form.nome} onChange={e => set('nome', e.target.value)} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Sobrenome</label>
                <input style={inputStyle} placeholder="Ex: Silva" value={form.sobrenome} onChange={e => set('sobrenome', e.target.value)} />
              </div>
            </>}

            {/* Campos comuns */}
            <div>
              <label style={labelStyle}>Telefone</label>
              <input style={inputStyle} placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input type="email" style={inputStyle} placeholder="contato@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Cidade</label>
              <input style={inputStyle} placeholder="São Paulo" value={form.municipio} onChange={e => set('municipio', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>UF</label>
              <input style={inputStyle} placeholder="SP" maxLength={2} value={form.uf} onChange={e => set('uf', e.target.value)} />
            </div>

            {/* Presença online */}
            <div className="sales-form-section is-full">
              <div className="sales-form-section__title">Presença online</div>
              <div className="sales-form-grid sales-form-grid--compact">
                <div>
                  <label style={labelStyle}>Instagram</label>
                  <input style={inputStyle} placeholder="https://instagram.com/..." value={form.instagram_url} onChange={e => set('instagram_url', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>LinkedIn</label>
                  <input style={inputStyle} placeholder="https://linkedin.com/..." value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Facebook</label>
                  <input style={inputStyle} placeholder="https://facebook.com/..." value={form.facebook_url} onChange={e => set('facebook_url', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Site</label>
                  <input style={inputStyle} placeholder="https://..." value={form.site_url} onChange={e => set('site_url', e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Origem</label>
              <select value={form.origem} onChange={e => set('origem', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {ORIGENS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status inicial</label>
              <select value={form.status_prospeccao} onChange={e => set('status_prospeccao', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (<option key={key} value={key}>{cfg.label}</option>))}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, color: '#B91C1C', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div className="sales-modal__footer">
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Criando...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function Leads({ empresas, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, tagFilter, setTagFilter, allTags, cnaeFilter = [], setCnaeFilter, allCnaes = [], onOpenLead, onUpdateEmpresa, onBulkUpdate, onBulkDelete, onCreateLead, tasks = [], totalCount, profiles = [] }) {
  const isMobile = useIsMobile()
  const isSuperAdmin = useIsSuperAdmin()
  const [sortField, setSortField] = useState('criado_em')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [vendorFilter, setVendorFilter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedIds, setSelectedIds] = useState([])
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  // Local search state: update input immediately, debounce the parent state
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const searchDebounceRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  function handleSearchChange(value) {
    setLocalSearch(value)
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setSearchQuery(value), 250)
  }

  function clearSearch() {
    setLocalSearch('')
    setSearchQuery('')
    searchInputRef.current?.focus()
  }

  // Keyboard shortcut: '/' focuses search
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const SAVED_FILTERS_KEY = 'tilim_saved_filters_v1'
  const [savedFilters, setSavedFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]') } catch { return [] }
  })
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  // Reset para página 1 ao mudar filtro ou busca
  useEffect(() => { setPage(1) }, [statusFilter, searchQuery, tagFilter, vendorFilter, cnaeFilter])

  // Limpa seleção ao trocar modo ou filtros
  useEffect(() => { setSelectedIds([]) }, [viewMode, statusFilter, searchQuery, tagFilter, vendorFilter, cnaeFilter])

  // Todos os vendedores do sistema (não só quem aparece nos leads já
  // carregados/filtrados — senão filtrar por "Não atribuídos" esvaziava
  // essa lista, já que nenhum lead unassigned tem vendedor_nome).
  const vendedoresDisponiveis = useMemo(() => {
    if (!isSuperAdmin) return []
    return profiles
      .map(p => ({ id: p.id, nome: [p.nome, p.sobrenome].filter(Boolean).join(' ') || p.nome || 'Sem nome' }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [profiles, isSuperAdmin])

  function persistFilters(list) {
    setSavedFilters(list)
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list))
  }

  function handleSaveFilter() {
    const name = saveFilterName.trim()
    if (!name) return
    const entry = {
      name,
      filters: { searchQuery, statusFilter, tagFilter, cnaeFilter, vendorFilter },
    }
    persistFilters([...savedFilters, entry])
    setSaveFilterName('')
    setShowSaveInput(false)
  }

  function handleLoadFilter(entry) {
    setSearchQuery(entry.filters.searchQuery || '')
    setStatusFilter(entry.filters.statusFilter || 'todos')
    setTagFilter(entry.filters.tagFilter || '')
    setCnaeFilter(entry.filters.cnaeFilter || [])
    setVendorFilter(entry.filters.vendorFilter || '')
  }

  function handleDeleteFilter(idx) {
    persistFilters(savedFilters.filter((_, i) => i !== idx))
  }

  function handleSort(col) {
    if (sortField === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  function handleViewMode(mode) {
    setViewMode(mode)
    if (mode === 'kanban' && statusFilter !== 'todos') setStatusFilter('todos')
  }

  async function handleStatusChange(empresa, newStatus, e) {
    e.stopPropagation()
    await onUpdateEmpresa(empresa.id, { status_prospeccao: newStatus })
  }

  const followupCount = useMemo(() => empresas.filter(e => hasOverdueTask(e.id, tasks)).length, [empresas, tasks])

  const sorted = useMemo(() => {
    let list = empresas
    if (vendorFilter === '__unassigned__') list = list.filter(e => !e.vendedor_id)
    else if (vendorFilter) list = list.filter(e => e.vendedor_id === vendorFilter)
    const fn = SORT_COLS[sortField]
    if (!fn) return list
    return [...list].sort((a, b) => sortDir === 'asc' ? fn(a, b) : fn(b, a))
  }, [empresas, sortField, sortDir, vendorFilter])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageItems = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  // Seleção
  const allPageIds = pageItems.map(e => e.id)
  const allPageSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.includes(id))
  const somePageSelected = allPageIds.some(id => selectedIds.includes(id))

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !allPageIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allPageIds])])
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleBulkStatus(status) {
    const ok = await onBulkUpdate(selectedIds, { status_prospeccao: status })
    if (ok) setSelectedIds([])
  }

  async function handleBulkAssign(vendedorId) {
    const vendor = vendedoresDisponiveis.find(v => v.id === vendedorId)
    const ok = await onBulkUpdate(selectedIds, { vendedor_id: vendedorId, vendedor_nome: vendor?.nome || '' })
    if (ok) setSelectedIds([])
  }

  async function handleBulkDelete() {
    const ok = await onBulkDelete(selectedIds)
    if (ok) setSelectedIds([])
  }

  function handleExport(format) {
    const lista = selectedIds.length > 0 ? sorted.filter(e => selectedIds.includes(e.id)) : sorted
    exportLeads(lista, format)
    setShowExportMenu(false)
  }

  const statusTabs = ['todos', ...Object.keys(STATUS_CONFIG)]

  return (
    <div className="sales-shell">
      {/* Toolbar */}
      <header className="sales-toolbar">
        <div className="sales-heading-row">
          <div className="sales-heading-copy">
            <span className="sales-eyebrow">Pipeline comercial</span>
            <div className="sales-title-row">
              <h1>Leads</h1>
              <span className="sales-count" aria-label={`${empresas.length} de ${totalCount} leads exibidos`}>
                {empresas.length} <span>/ {totalCount}</span>
              </span>
              {followupCount > 0 && (
                <span className="sales-attention-pill">
                  <IconClock size={12} color="currentColor" /> {followupCount} precisam de atenção
                </span>
              )}
            </div>
          </div>

          <div className="sales-heading-actions">
            {/* Exportar */}
            <div className="sales-export">
              <button
                onClick={() => setShowExportMenu(s => !s)}
                title={selectedIds.length > 0 ? `Exportar ${selectedIds.length} selecionado(s)` : 'Exportar leads filtrados'}
                className="sales-action sales-action--secondary"
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
              >
                <IconDownload size={14} color="currentColor" /> <span>Exportar</span>
              </button>
              {showExportMenu && (
                <>
                  <div onClick={() => setShowExportMenu(false)} className="sales-menu-scrim" />
                  <div className="sales-export-menu" role="menu">
                    <button onClick={() => handleExport('xlsx')} role="menuitem">Excel <span>.xlsx</span></button>
                    <button onClick={() => handleExport('csv')} role="menuitem">CSV <span>.csv</span></button>
                  </div>
                </>
              )}
            </div>

            {/* Novo Lead */}
            <button onClick={() => setNewLeadOpen(true)} className="sales-action sales-action--primary">
              <span aria-hidden="true">+</span> Novo lead
            </button>

            {/* View toggle — só desktop */}
            {!isMobile && <div className="sales-view-toggle" aria-label="Modo de visualização">
              <button
                onClick={() => handleViewMode('list')}
                title="Visualização em lista"
                className={viewMode === 'list' ? 'is-active' : ''}
                aria-pressed={viewMode === 'list'}
              >
                <IconList size={15} color="currentColor" />
              </button>
              <button
                onClick={() => handleViewMode('kanban')}
                title="Visualização Kanban"
                className={viewMode === 'kanban' ? 'is-active' : ''}
                aria-pressed={viewMode === 'kanban'}
              >
                <IconKanban size={15} color="currentColor" />
              </button>
            </div>}
          </div>
        </div>

        <div className={`sales-filter-row${viewMode === 'kanban' ? ' is-kanban' : ''}`}>
          <div className="sales-search">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nome, CNPJ, cidade, segmento... (/ para focar)"
              aria-label="Buscar leads"
              value={localSearch}
              onChange={e => handleSearchChange(e.target.value)}
            />
            <span className="sales-search__icon" aria-hidden="true"><IconSearch size={16} color="currentColor" /></span>
            {localSearch && (
              <button
                onClick={clearSearch}
                className="sales-search__clear"
                aria-label="Limpar busca"
              >
                <IconX size={14} color="currentColor" />
              </button>
            )}
          </div>
          {viewMode === 'list' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="sales-filter-select"
              aria-label="Filtrar por status"
            >
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          )}
          {allTags && allTags.length > 0 && (
            <select
              value={tagFilter || ''}
              onChange={e => setTagFilter(e.target.value)}
              className="sales-filter-select"
              aria-label="Filtrar por etiqueta"
            >
              <option value="">Todas as etiquetas</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
          {allCnaes.length > 0 && (
            <CnaeFilter allCnaes={allCnaes} cnaeFilter={cnaeFilter} setCnaeFilter={setCnaeFilter} />
          )}
          {isSuperAdmin && (
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className={`sales-filter-select${vendorFilter ? ' is-active' : ''}`}
              aria-label="Filtrar por vendedor"
            >
              <option value="">Todos os vendedores</option>
              <option value="__unassigned__">Não atribuídos</option>
              {vendedoresDisponiveis.map(v => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          )}
        </div>

        {/* Filtros salvos */}
        <div className="sales-saved-filters">
          {savedFilters.map((f, i) => (
            <span key={i} className="sales-saved-filter">
              <button type="button" onClick={() => handleLoadFilter(f)} className="sales-saved-filter__load">{f.name}</button>
              <button type="button" onClick={() => handleDeleteFilter(i)} className="sales-saved-filter__delete" aria-label={`Excluir filtro ${f.name}`}>×</button>
            </span>
          ))}
          {showSaveInput ? (
            <span className="sales-save-filter-form">
              <input
                autoFocus
                value={saveFilterName}
                onChange={e => setSaveFilterName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveFilter(); if (e.key === 'Escape') setShowSaveInput(false) }}
                placeholder="Nome do filtro..."
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 12, outline: 'none', width: 160 }}
              />
              <button type="button" onClick={handleSaveFilter} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Salvar</button>
              <button type="button" onClick={() => setShowSaveInput(false)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </span>
          ) : (
            <button type="button" onClick={() => setShowSaveInput(true)} className="sales-save-filter-button">
              <span aria-hidden="true">+</span> Salvar filtro
            </button>
          )}
        </div>

        {/* Status tabs — só na view de lista */}
        {viewMode === 'list' && (
          <div className="sales-status-tabs" aria-label="Filtrar por etapa do funil">
            {statusTabs.map(s => {
              const cfg = STATUS_CONFIG[s]
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={isActive ? 'is-active' : ''}
                  aria-pressed={isActive}
                  style={{
                    padding: '3px 10px', borderRadius: 20, border: '1px solid',
                    fontSize: 11, cursor: 'pointer', fontWeight: isActive ? 500 : 400,
                    background: isActive ? (cfg?.bg || 'var(--bg4)') : 'transparent',
                    color: isActive ? (cfg?.color || 'var(--text)') : 'var(--text3)',
                    borderColor: isActive ? `${cfg?.color || 'var(--accent)'}60` : 'var(--border)',
                    transition: 'all 0.1s',
                  }}
                >
                  {cfg?.label || 'Todos'}
                </button>
              )
            })}
            {/* Tab follow-up especial */}
            <button
              onClick={() => setStatusFilter('followup')}
              className={statusFilter === 'followup' ? 'is-active is-attention' : 'is-attention'}
              aria-pressed={statusFilter === 'followup'}
              style={{
                padding: '3px 10px', borderRadius: 20, border: '1px solid',
                fontSize: 11, cursor: 'pointer', fontWeight: statusFilter === 'followup' ? 500 : 400,
                background: statusFilter === 'followup' ? '#FFFBEB' : 'transparent',
                color: statusFilter === 'followup' ? '#B45309' : 'var(--text3)',
                borderColor: statusFilter === 'followup' ? '#F59E0B60' : 'var(--border)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconClock size={11} color={statusFilter === 'followup' ? '#B45309' : 'var(--text3)'} />
                Atenção{followupCount > 0 ? ` (${followupCount})` : ''}
              </span>
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="sales-content">
        {viewMode === 'kanban' ? (
          loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
          ) : (
            <KanbanView
              leads={sorted}
              tasks={tasks}
              onOpenLead={onOpenLead}
              onUpdateEmpresa={onUpdateEmpresa}
              isSuperAdmin={isSuperAdmin}
              isMobile={isMobile}
            />
          )
        ) : (
          <div className="sales-list-scroller">
            {loading ? (
              <div className="sales-state sales-state--loading">Carregando leads...</div>
            ) : sorted.length === 0 ? (
              <div className="sales-state">
                <div className="sales-state__icon"><IconInbox size={27} color="currentColor" /></div>
                <div className="sales-state__title">Nenhum lead encontrado</div>
                <div className="sales-state__copy">Ajuste os filtros ou aguarde novos registros</div>
              </div>
            ) : isMobile ? (
              <div className="sales-mobile-list">
                <label className="sales-mobile-select-all">
                  <span>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                      onChange={toggleSelectAll}
                    />
                    Selecionar página
                  </span>
                  <strong>{pageItems.length} leads</strong>
                </label>
                {pageItems.map((e, i) => {
                  const atencao = hasOverdueTask(e.id, tasks)
                  const isSelected = selectedIds.includes(e.id)
                  return (
                    <article
                      key={e.id}
                      className={`sales-mobile-card${isSelected ? ' is-selected' : ''}`}
                      onClick={() => onOpenLead(e)}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onOpenLead(e)
                        }
                      }}
                      tabIndex={0}
                      style={{ '--enter-delay': `${Math.min(i, 10) * 28}ms` }}
                    >
                      <div className="sales-mobile-card__header">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(e.id)}
                          onClick={event => event.stopPropagation()}
                          aria-label={`Selecionar ${leadName(e)}`}
                        />
                        <div className="sales-mobile-card__identity">
                          <div className="sales-mobile-card__name">
                            {atencao && <span className="sales-attention-dot" title="Tem tarefa atrasada" />}
                            <span>{leadName(e)}</span>
                          </div>
                          <div className="sales-mobile-card__meta">
                            {e.tipo === 'pessoa' ? 'Pessoa' : e.eh_mei ? 'MEI' : e.porte_descricao || 'Empresa'}
                            {(e.municipio || e.uf) && ` · ${[e.municipio, e.uf].filter(Boolean).join(', ')}`}
                          </div>
                        </div>
                        <StatusBadge status={e.status_prospeccao} />
                      </div>

                      {e.cnae_principal_descricao && (
                        <p className="sales-mobile-card__segment">{e.cnae_principal_descricao}</p>
                      )}

                      {e.tags && e.tags.length > 0 && (
                        <div className="sales-tag-row">
                          {e.tags.slice(0, 3).map(tag => {
                            const tc = tagColor(tag)
                            return <span key={tag} style={{ background: tc.bg, color: tc.color }}>{tag}</span>
                          })}
                          {e.tags.length > 3 && <span className="is-more">+{e.tags.length - 3}</span>}
                        </div>
                      )}

                      {isSuperAdmin && e.vendedor_nome && (
                        <div className="sales-mobile-card__owner">Responsável · <strong>{e.vendedor_nome}</strong></div>
                      )}

                      <div className="sales-mobile-card__footer">
                        <div className="sales-mobile-card__contacts">
                          {e.email && <span title={e.email}><IconMail size={14} color="currentColor" /> E-mail</span>}
                          {e.telefone && <span title={e.telefone}><IconPhone size={14} color="currentColor" /> Telefone</span>}
                          {e.cnpj && <span className="is-mono">{e.cnpj}</span>}
                        </div>
                        <select
                          value={e.status_prospeccao || 'novo'}
                          onChange={event => handleStatusChange(e, event.target.value, event)}
                          onClick={event => event.stopPropagation()}
                          aria-label={`Alterar status de ${leadName(e)}`}
                        >
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                          ))}
                        </select>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px 6px 16px', width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                        onChange={toggleSelectAll}
                        aria-label="Selecionar todos os leads desta página"
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--accent)' }}
                      />
                    </th>
                    <SortHeader label="Empresa"    col="nome"      sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>CNPJ</th>
                    <SortHeader label="Cidade / UF" col="municipio" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Segmento</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Contato</th>
                    <SortHeader label="Abertura"   col="abertura"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Status"     col="status"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e, i) => {
                    const atencao = hasOverdueTask(e.id, tasks)
                    const isSelected = selectedIds.includes(e.id)
                    return (
                      <tr
                        key={e.id}
                        onClick={() => onOpenLead(e)}
                        onKeyDown={event => {
                          if (event.target !== event.currentTarget) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onOpenLead(e)
                          }
                        }}
                        tabIndex={0}
                        className={isSelected ? 'is-selected' : ''}
                        style={{ cursor: 'pointer', animation: `fadeIn 0.2s ease ${Math.min(i, 15) * 0.02}s both`, opacity: isSelected ? 0.92 : 1 }}
                      >
                        <td
                          onClick={ev => { ev.stopPropagation(); toggleSelect(e.id) }}
                          style={{ padding: '10px 10px 10px 16px', background: isSelected ? 'var(--bg3)' : 'var(--bg2)', borderRadius: '8px 0 0 8px', transition: 'background 0.1s', cursor: 'default', width: 36 }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(e.id)}
                            onClick={ev => ev.stopPropagation()}
                            aria-label={`Selecionar ${leadName(e)}`}
                            style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--accent)' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', background: isSelected ? 'var(--bg3)' : 'var(--bg2)', maxWidth: 200, transition: 'background 0.1s', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {atencao && (
                              <span title="Tem tarefa atrasada" style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {leadName(e)}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                                {e.tipo === 'pessoa' ? 'Pessoa' : e.eh_mei ? 'MEI' : e.porte_descricao || '—'}
                              </div>
                              {e.tags && e.tags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                                  {e.tags.slice(0, 3).map(tag => {
                                    const tc = tagColor(tag)
                                    return (
                                      <span key={tag} style={{ padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: tc.bg, color: tc.color }}>
                                        {tag}
                                      </span>
                                    )
                                  })}
                                  {e.tags.length > 3 && (
                                    <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)' }}>+{e.tags.length - 3}</span>
                                  )}
                                </div>
                              )}
                              {isSuperAdmin && e.vendedor_nome && (
                                <div style={{ marginTop: 4 }}>
                                  <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 3 }}>
                                    {e.vendedor_nome}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                            {e.cnpj?.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || e.cnpj}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{e.municipio}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.uf}</div>
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', maxWidth: 180, transition: 'background 0.1s' }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {e.cnae_principal_descricao || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {e.email && <span title={e.email} style={{ color: 'var(--text3)', display: 'flex' }}><IconMail size={14} color="var(--text3)" /></span>}
                            {e.telefone && <span title={e.telefone} style={{ color: 'var(--text3)', display: 'flex' }}><IconPhone size={14} color="var(--text3)" /></span>}
                            {!e.email && !e.telefone && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                            {e.data_abertura ? format(parseDate(e.data_abertura), 'dd/MM/yy') : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                          <StatusBadge status={e.status_prospeccao} />
                        </td>
                        <td style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: '0 8px 8px 0', transition: 'background 0.1s' }}>
                          <select
                            value={e.status_prospeccao || 'novo'}
                            onChange={ev => handleStatusChange(e, ev.target.value, ev)}
                            onClick={ev => ev.stopPropagation()}
                            aria-label={`Alterar status de ${leadName(e)}`}
                            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, padding: '3px 6px', cursor: 'pointer', outline: 'none' }}
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal novo lead */}
      {newLeadOpen && (
        <NewLeadModal
          onClose={() => setNewLeadOpen(false)}
          onSave={async data => {
            const result = await onCreateLead(data)
            return result
          }}
        />
      )}

      {/* Barra de ações em lote */}
      {viewMode === 'list' && selectedIds.length > 0 && (
        <BulkBar
          count={selectedIds.length}
          onClear={() => setSelectedIds([])}
          onStatusChange={handleBulkStatus}
          onAssign={handleBulkAssign}
          onDelete={handleBulkDelete}
          vendedores={vendedoresDisponiveis}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Paginação — só na view de lista */}
      {viewMode === 'list' && !loading && sorted.length > PER_PAGE && (
        <nav className="sales-pagination" aria-label="Paginação de leads">
          <span className="sales-pagination__summary">
            {((safePage - 1) * PER_PAGE) + 1}–{Math.min(safePage * PER_PAGE, sorted.length)} de {sorted.length} leads
          </span>
          <div className="sales-pagination__controls">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="sales-pagination__direction"
            >
              <span aria-hidden="true">←</span> Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} className="sales-pagination__ellipsis">…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`sales-pagination__page${safePage === p ? ' is-active' : ''}`}
                      aria-current={safePage === p ? 'page' : undefined}
                      style={{
                        padding: '5px 10px', borderRadius: 6, border: '1px solid',
                        fontSize: 12, cursor: 'pointer', minWidth: 34,
                        background: safePage === p ? 'var(--accent)' : 'var(--bg3)',
                        color: safePage === p ? '#fff' : 'var(--text2)',
                        borderColor: safePage === p ? 'var(--accent)' : 'var(--border)',
                        fontWeight: safePage === p ? 500 : 400,
                      }}
                    >
                      {p}
                    </button>
                  )
              )
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="sales-pagination__direction"
            >
              Próxima <span aria-hidden="true">→</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
