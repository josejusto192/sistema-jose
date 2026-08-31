import React, { useState, useEffect, useRef } from 'react'
import { IconX } from './Icons.jsx'

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function countActive(f) {
  let n = 0
  if (f.capitalMin !== '' || f.capitalMax !== '') n++
  if (f.porte.length > 0) n++
  if (f.uf.length > 0) n++
  if (f.natureza.length > 0) n++
  if (f.aberturaDe || f.aberturaAte) n++
  return n
}

const inputStyle = {
  width: '100%', padding: '6px 9px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg3)',
  color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const sectionLabel = { fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 9px', borderRadius: 20, border: '1px solid var(--border)',
        fontSize: 11, cursor: 'pointer',
        background: active ? 'var(--accent)' : 'var(--bg3)',
        color: active ? '#fff' : 'var(--text2)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

// Painel "Mais filtros" da aba Leads: capital social, porte, UF e natureza
// jurídica, complementando os filtros de status/etiqueta/segmento já existentes.
export default function LeadsMoreFilters({ filters, setFilters, allPortes = [], allNaturezas = [] }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const ref = useRef(null)

  useEffect(() => { setDraft(filters) }, [filters, open])

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function set(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  function toggleIn(field, value) {
    setDraft(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value],
    }))
  }

  function apply() {
    setFilters(draft)
    setOpen(false)
  }

  function clearAll() {
    const cleared = { capitalMin: '', capitalMax: '', porte: [], uf: [], natureza: [], aberturaDe: '', aberturaAte: '' }
    setDraft(cleared)
    setFilters(cleared)
  }

  const activeCount = countActive(filters)
  const hasFilter = activeCount > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: hasFilter ? 'var(--accent)' : 'var(--bg3)',
          color: hasFilter ? '#fff' : 'var(--text)',
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap', outline: 'none', fontFamily: 'inherit',
        }}
      >
        {hasFilter ? `Mais filtros (${activeCount})` : 'Mais filtros'}
        {hasFilter && (
          <span
            onClick={e => { e.stopPropagation(); clearAll(); setOpen(false) }}
            style={{ display: 'flex', opacity: 0.8 }}
          >
            <IconX size={12} color="#fff" />
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 320, padding: 14,
        }}>
          {/* Capital social */}
          <div style={{ marginBottom: 14 }}>
            <div style={sectionLabel}>Capital social (R$)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min={0} placeholder="Mínimo"
                value={draft.capitalMin} onChange={e => set('capitalMin', e.target.value)}
                style={inputStyle}
              />
              <input
                type="number" min={0} placeholder="Máximo"
                value={draft.capitalMax} onChange={e => set('capitalMax', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Data de abertura */}
          <div style={{ marginBottom: 14 }}>
            <div style={sectionLabel}>Data de abertura</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date" value={draft.aberturaDe} onChange={e => set('aberturaDe', e.target.value)}
                style={inputStyle}
              />
              <input
                type="date" value={draft.aberturaAte} onChange={e => set('aberturaAte', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Porte */}
          {allPortes.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={sectionLabel}>Porte</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {allPortes.map(p => (
                  <Chip key={p} label={p} active={draft.porte.includes(p)} onClick={() => toggleIn('porte', p)} />
                ))}
              </div>
            </div>
          )}

          {/* UF */}
          <div style={{ marginBottom: 14 }}>
            <div style={sectionLabel}>Estado (UF)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 90, overflowY: 'auto' }}>
              {UF_LIST.map(uf => (
                <Chip key={uf} label={uf} active={draft.uf.includes(uf)} onClick={() => toggleIn('uf', uf)} />
              ))}
            </div>
          </div>

          {/* Natureza jurídica */}
          {allNaturezas.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={sectionLabel}>Natureza jurídica</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 110, overflowY: 'auto' }}>
                {allNaturezas.map(n => (
                  <Chip key={n} label={n} active={draft.natureza.includes(n)} onClick={() => toggleIn('natureza', n)} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button
              type="button" onClick={clearAll}
              style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              Limpar
            </button>
            <button
              type="button" onClick={apply}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
