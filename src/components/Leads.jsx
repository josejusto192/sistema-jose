import React, { useState, useMemo, useEffect, useRef } from 'react'
import { STATUS_CONFIG } from '../constants.js'
import { useTheme, useIsSuperAdmin } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, differenceInDays, parseISO } from 'date-fns'
import { IconSearch, IconClock, IconMail, IconPhone, IconInbox, IconList, IconKanban } from './Icons.jsx'

const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']
const FOLLOWUP_DAYS = Number(localStorage.getItem('cfg_followup_dias')) || 3
const PER_PAGE = 20

const KANBAN_STATUSES = [
  'novo', 'contatado', 'aguardando', 'respondeu',
  'call_agendada', 'proposta_enviada', 'fechou', 'perdido',
]

function needsFollowup(e) {
  if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
  const ref = e.atualizado_em || e.criado_em
  if (!ref) return false
  return differenceInDays(new Date(), new Date(ref)) >= FOLLOWUP_DAYS
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
  nome:        (a, b) => (a.nome_fantasia || a.razao_social || '').localeCompare(b.nome_fantasia || b.razao_social || ''),
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
function KanbanCard({ empresa: e, onOpen, onDragStart, onDragEnd, isDragging, isSuperAdmin }) {
  const atencao = needsFollowup(e)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(e)}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 10px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'box-shadow 0.12s, transform 0.12s, opacity 0.12s',
        userSelect: 'none',
      }}
      onMouseEnter={el => {
        el.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)'
        el.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={el => {
        el.currentTarget.style.boxShadow = 'none'
        el.currentTarget.style.transform = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {atencao && (
          <div
            title="Precisa de atenção"
            style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 3 }}
          />
        )}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, flex: 1 }}>
          {e.nome_fantasia || e.razao_social}
        </div>
      </div>

      {e.municipio && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
          {e.municipio}{e.uf ? `, ${e.uf}` : ''}
        </div>
      )}

      {e.tags && e.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
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
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500 }}>{e.vendedor_nome}</span>
        </div>
      )}
    </div>
  )
}

/* ─── Kanban board ─────────────────────────────────────────────────────────── */
function KanbanView({ leads, onOpenLead, onUpdateEmpresa, isSuperAdmin, isMobile }) {
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
    <div style={{
      display: 'flex', gap: 10, padding: isMobile ? '12px 16px 16px' : '14px 32px 20px',
      overflowX: 'auto', overflowY: 'hidden',
      flex: 1, alignItems: 'stretch', minHeight: 0,
    }}>
      {KANBAN_STATUSES.map(status => {
        const cfg = STATUS_CONFIG[status]
        const columnLeads = leads.filter(e => e.status_prospeccao === status)
        const isOver = dragOver === status && dragId !== null

        return (
          <div
            key={status}
            onDragOver={e => e.preventDefault()}
            onDragEnter={() => handleDragEnter(status)}
            onDragLeave={() => handleDragLeave(status)}
            onDrop={() => handleDrop(status)}
            style={{
              width: 210, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              background: isOver ? 'var(--bg3)' : 'var(--bg)',
              border: `1px solid ${isOver ? cfg.dot : 'var(--border)'}`,
              borderRadius: 10,
              transition: 'border-color 0.15s, background 0.15s',
              overflow: 'hidden',
            }}
          >
            {/* Column header */}
            <div style={{
              padding: '9px 12px 8px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0, background: 'var(--bg2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{cfg.label}</span>
              </div>
              <span style={{
                fontSize: 10, color: 'var(--text3)',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                padding: '1px 6px', borderRadius: 8, fontWeight: 500,
              }}>
                {columnLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '8px 7px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {columnLeads.map(e => (
                <KanbanCard
                  key={e.id}
                  empresa={e}
                  onOpen={onOpenLead}
                  onDragStart={() => setDragId(e.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); dragCounters.current = {} }}
                  isDragging={dragId === e.id}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
              {columnLeads.length === 0 && (
                <div style={{
                  padding: '16px 8px', textAlign: 'center',
                  color: 'var(--text3)', fontSize: 11,
                  border: `1px dashed ${isOver ? cfg.dot : 'var(--border)'}`,
                  borderRadius: 8, opacity: 0.6, transition: 'border-color 0.15s',
                }}>
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
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 30,
      background: 'var(--bg2)', borderTop: '1px solid var(--border)',
      padding: '10px 32px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
      animation: 'fadeIn 0.15s ease',
    }}>
      {/* Count + clear */}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {count} selecionado{count !== 1 ? 's' : ''}
      </span>
      <button
        onClick={onClear}
        style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
      >
        limpar
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Mudar status */}
      <select
        disabled={busy}
        defaultValue=""
        onChange={e => { handleStatus(e.target.value); e.target.value = '' }}
        style={{
          padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
          background: 'var(--bg3)', color: 'var(--text)', fontSize: 12,
          cursor: 'pointer', outline: 'none', opacity: busy ? 0.5 : 1,
        }}
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
          onChange={e => { handleAssign(e.target.value); e.target.value = '' }}
          style={{
            padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg3)', color: 'var(--text)', fontSize: 12,
            cursor: 'pointer', outline: 'none', opacity: busy ? 0.5 : 1,
          }}
        >
          <option value="" disabled>Atribuir a…</option>
          {vendedores.map(v => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>
      )}

      <div style={{ flex: 1 }} />

      {/* Excluir */}
      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function Leads({ empresas, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, tagFilter, setTagFilter, allTags, onOpenLead, onUpdateEmpresa, onBulkUpdate, onBulkDelete, totalCount }) {
  const isMobile = useIsMobile()
  const isSuperAdmin = useIsSuperAdmin()
  const [sortField, setSortField] = useState('criado_em')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [vendorFilter, setVendorFilter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedIds, setSelectedIds] = useState([])

  // Reset para página 1 ao mudar filtro ou busca
  useEffect(() => { setPage(1) }, [statusFilter, searchQuery, tagFilter, vendorFilter])

  // Limpa seleção ao trocar modo ou filtros
  useEffect(() => { setSelectedIds([]) }, [viewMode, statusFilter, searchQuery, tagFilter, vendorFilter])

  // Lista de vendedores únicos nos leads carregados (superadmin)
  const vendedoresDisponiveis = useMemo(() => {
    if (!isSuperAdmin) return []
    const map = {}
    empresas.forEach(e => {
      if (e.vendedor_id && e.vendedor_nome) map[e.vendedor_id] = e.vendedor_nome
    })
    return Object.entries(map).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [empresas, isSuperAdmin])

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

  const followupCount = useMemo(() => empresas.filter(needsFollowup).length, [empresas])

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

  const statusTabs = ['todos', ...Object.keys(STATUS_CONFIG)]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: isMobile ? '12px 16px 10px' : '20px 32px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: 'var(--text)' }}>Leads</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
            {empresas.length} / {totalCount}
          </span>
          {followupCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, background: '#FFFBEB', color: '#B45309', border: '1px solid #F59E0B60', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
              <IconClock size={12} color="#B45309" /> {followupCount} precisam de atenção
            </span>
          )}

          {/* View toggle — só desktop */}
          {!isMobile && <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
            <button
              onClick={() => handleViewMode('list')}
              title="Visualização em lista"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 5, border: 'none',
                background: viewMode === 'list' ? 'var(--bg2)' : 'transparent',
                color: viewMode === 'list' ? 'var(--text)' : 'var(--text3)',
                cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <IconList size={14} color={viewMode === 'list' ? 'var(--text)' : 'var(--text3)'} />
            </button>
            <button
              onClick={() => handleViewMode('kanban')}
              title="Visualização Kanban"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 5, border: 'none',
                background: viewMode === 'kanban' ? 'var(--bg2)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--text)' : 'var(--text3)',
                cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <IconKanban size={14} color={viewMode === 'kanban' ? 'var(--text)' : 'var(--text3)'} />
            </button>
          </div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: viewMode === 'kanban' ? 0 : 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ, cidade, segmento..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex' }}><IconSearch size={15} color="var(--text3)" /></span>
          </div>
          {viewMode === 'list' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
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
              style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Todas as etiquetas</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
          {isSuperAdmin && (
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              style={{ padding: '8px 12px', background: vendorFilter ? 'var(--accent)' : 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: vendorFilter ? '#fff' : 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Todos os vendedores</option>
              <option value="__unassigned__">Não atribuídos</option>
              {vendedoresDisponiveis.map(v => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          )}
        </div>

        {/* Status tabs — só na view de lista */}
        {viewMode === 'list' && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {statusTabs.map(s => {
              const cfg = STATUS_CONFIG[s]
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
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
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'kanban' ? (
          loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
          ) : (
            <KanbanView
              leads={sorted}
              onOpenLead={onOpenLead}
              onUpdateEmpresa={onUpdateEmpresa}
              isSuperAdmin={isSuperAdmin}
              isMobile={isMobile}
            />
          )
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0 0 16px' : '0 32px 16px', background: 'var(--bg)' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13, animation: 'pulse 1.5s infinite' }}>Carregando...</div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
                <div style={{ marginBottom: 10, opacity: 0.3 }}><IconInbox size={32} color="var(--text3)" /></div>
                <div style={{ fontSize: 14 }}>Nenhum lead encontrado</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros ou aguarde novos registros</div>
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'separate', borderSpacing: '0 3px', marginTop: 14 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px 6px 16px', width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                        onChange={toggleSelectAll}
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
                    const atencao = needsFollowup(e)
                    const isSelected = selectedIds.includes(e.id)
                    return (
                      <tr
                        key={e.id}
                        onClick={() => onOpenLead(e)}
                        style={{ cursor: 'pointer', animation: `fadeIn 0.2s ease ${Math.min(i, 15) * 0.02}s both`, opacity: isSelected ? 0.92 : 1 }}
                        onMouseEnter={el => el.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--bg3)')}
                        onMouseLeave={el => el.currentTarget.querySelectorAll('td').forEach(td => td.style.background = isSelected ? 'var(--bg3)' : 'var(--bg2)')}
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
                            style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--accent)' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', background: isSelected ? 'var(--bg3)' : 'var(--bg2)', maxWidth: 200, transition: 'background 0.1s', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {atencao && (
                              <span title={`Sem atualização há ${FOLLOWUP_DAYS}+ dias`} style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {e.nome_fantasia || e.razao_social}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                                {e.eh_mei ? 'MEI' : e.porte_descricao || '—'}
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
        <div style={{ padding: isMobile ? '10px 16px' : '12px 32px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {((safePage - 1) * PER_PAGE) + 1}–{Math.min(safePage * PER_PAGE, sorted.length)} de {sorted.length} leads
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1 }}
            >
              ← Anterior
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
                  ? <span key={`e${i}`} style={{ fontSize: 12, color: 'var(--text3)', padding: '0 4px' }}>…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
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
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1 }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
