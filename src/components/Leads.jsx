import React, { useState, useMemo, useEffect, useRef } from 'react'
import { STATUS_CONFIG, leadName } from '../constants.js'
import { useTheme, useIsSuperAdmin } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, parseISO } from 'date-fns'
import { IconSearch, IconClock, IconMail, IconPhone, IconInbox, IconList, IconKanban, IconX } from './Icons.jsx'

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
          {leadName(e)}
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
                  tasks={tasks}
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

/* ─── CNAE multi-select filter ─────────────────────────────────────────────── */
function CnaeFilter({ allCnaes, cnaeFilter, setCnaeFilter }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const visible = search
    ? allCnaes.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : allCnaes

  const hasFilter = cnaeFilter.length > 0

  function toggle(cnae) {
    setCnaeFilter(prev => prev.includes(cnae) ? prev.filter(c => c !== cnae) : [...prev, cnae])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: hasFilter ? 'var(--accent)' : 'var(--bg3)',
          color: hasFilter ? '#fff' : 'var(--text)',
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap', outline: 'none',
        }}
      >
        {hasFilter ? `Segmento (${cnaeFilter.length})` : 'Segmento'}
        {hasFilter && (
          <span
            onClick={e => { e.stopPropagation(); setCnaeFilter([]); setOpen(false) }}
            style={{ display: 'flex', opacity: 0.8 }}
          >
            <IconX size={12} color="#fff" />
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 320,
        }}>
          {/* Search inside dropdown */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              placeholder="Filtrar segmentos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                Nenhum segmento encontrado
              </div>
            ) : visible.map(cnae => {
              const checked = cnaeFilter.includes(cnae)
              return (
                <label
                  key={cnae}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 14px', cursor: 'pointer',
                    background: checked ? 'var(--bg3)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(cnae)}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{cnae}</span>
                </label>
              )
            })}
          </div>

          {/* Footer */}
          {hasFilter && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{cnaeFilter.length} selecionado{cnaeFilter.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setCnaeFilter([])}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Limpar filtro
              </button>
            </div>
          )}
        </div>
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)',
        width: '100%', maxWidth: 540,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Novo Lead</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <IconX size={18} color="var(--text3)" />
          </button>
        </div>

        {/* Body — scrollable */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>

          {/* Tipo selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[{ value: 'empresa', label: '🏢 Empresa' }, { value: 'pessoa', label: '👤 Pessoa' }].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTipo(opt.value)}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>

            {/* Campos empresa */}
            {isEmpresa && <>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome fantasia</label>
                <input style={inputStyle} placeholder="Ex: Padaria do João" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} autoFocus />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Razão social</label>
                <input style={inputStyle} placeholder="Ex: João Silva Alimentos ME" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
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
            <div style={{ gridColumn: '1 / -1', paddingTop: 4, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 12, letterSpacing: 0.5 }}>PRESENÇA ONLINE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
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
export default function Leads({ empresas, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, tagFilter, setTagFilter, allTags, cnaeFilter = [], setCnaeFilter, allCnaes = [], onOpenLead, onUpdateEmpresa, onBulkUpdate, onBulkDelete, onCreateLead, tasks = [], totalCount }) {
  const isMobile = useIsMobile()
  const isSuperAdmin = useIsSuperAdmin()
  const [sortField, setSortField] = useState('criado_em')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [vendorFilter, setVendorFilter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedIds, setSelectedIds] = useState([])
  const [newLeadOpen, setNewLeadOpen] = useState(false)

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

  // Lista de vendedores únicos nos leads carregados (superadmin)
  const vendedoresDisponiveis = useMemo(() => {
    if (!isSuperAdmin) return []
    const map = {}
    empresas.forEach(e => {
      if (e.vendedor_id && e.vendedor_nome) map[e.vendedor_id] = e.vendedor_nome
    })
    return Object.entries(map).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [empresas, isSuperAdmin])

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

          {/* Novo Lead */}
          <button
            onClick={() => setNewLeadOpen(true)}
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            + Novo Lead
          </button>

          {/* View toggle — só desktop */}
          {!isMobile && <div style={{ display: 'flex', gap: 2, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
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
          {allCnaes.length > 0 && (
            <CnaeFilter allCnaes={allCnaes} cnaeFilter={cnaeFilter} setCnaeFilter={setCnaeFilter} />
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

        {/* Filtros salvos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {savedFilters.map((f, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              <span onClick={() => handleLoadFilter(f)} style={{ cursor: 'pointer' }}>🔖 {f.name}</span>
              <button type="button" onClick={() => handleDeleteFilter(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 14, display: 'flex' }}>×</button>
            </span>
          ))}
          {showSaveInput ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
            <button type="button" onClick={() => setShowSaveInput(true)} style={{ padding: '3px 10px', borderRadius: 20, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
              + Salvar filtro atual
            </button>
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
              tasks={tasks}
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
                    const atencao = hasOverdueTask(e.id, tasks)
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
