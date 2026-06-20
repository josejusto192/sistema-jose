import React, { useState, useEffect, useRef } from 'react'
import { IconX } from './Icons.jsx'

// Multi-select de segmento (CNAE) com busca, usado nos filtros de Leads,
// na seleção de destinatários de campanhas e no filtro de automações.
export default function CnaeFilter({ allCnaes, cnaeFilter, setCnaeFilter, label = 'Segmento' }) {
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
          whiteSpace: 'nowrap', outline: 'none', fontFamily: 'inherit',
        }}
      >
        {hasFilter ? `${label} (${cnaeFilter.length})` : label}
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
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              placeholder="Filtrar segmentos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

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

          {hasFilter && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{cnaeFilter.length} selecionado{cnaeFilter.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setCnaeFilter([])}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
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
