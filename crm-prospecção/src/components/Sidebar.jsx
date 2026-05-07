import React from 'react'
import { STATUS_CONFIG } from '../constants.js'

export default function Sidebar({ view, setView, empresas }) {
  const total = empresas.length
  const novos = empresas.filter(e => e.status_prospeccao === 'novo').length
  const fechados = empresas.filter(e => e.status_prospeccao === 'fechou').length

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
    { id: 'leads', label: 'Leads', icon: '◈', badge: total },
  ]

  return (
    <aside style={{
      width: 220,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px', color: 'var(--text)' }}>
          PROSP<span style={{ color: 'var(--accent)' }}>.</span>CRM
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          José Justo
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: view === item.id ? 'var(--bg4)' : 'transparent',
              color: view === item.id ? 'var(--text)' : 'var(--text2)',
              fontSize: 13,
              fontWeight: view === item.id ? 500 : 400,
              cursor: 'pointer',
              marginBottom: 2,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </span>
            {item.badge != null && (
              <span style={{
                background: view === item.id ? 'var(--accent)' : 'var(--border2)',
                color: view === item.id ? '#fff' : 'var(--text2)',
                borderRadius: 20,
                padding: '1px 7px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Status rápidos */}
        <div style={{ marginTop: 20, padding: '0 4px' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
            Status
          </div>
          {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, cfg]) => {
            const count = empresas.filter(e => e.status_prospeccao === key).length
            if (count === 0) return null
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer stats */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Novos hoje</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{novos}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Fechados</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>{fechados}</span>
        </div>
      </div>
    </aside>
  )
}
