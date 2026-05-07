import React from 'react'
import { STATUS_CONFIG } from '../constants.js'

export default function Sidebar({ view, setView, empresas, contratos, theme, onToggleTheme }) {
  const total = empresas.length
  const fechados = empresas.filter(e => e.status_prospeccao === 'fechou').length
  const contratosAtivos = contratos.filter(c => c.status === 'ativo').length

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',  icon: IconGrid },
    { id: 'leads',      label: 'Leads',      icon: IconList,     badge: total },
    { id: 'contratos',  label: 'Contratos',  icon: IconContract, badge: contratosAtivos || null },
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
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px', color: 'var(--text)' }}>
          Prosp<span style={{ color: 'var(--accent)' }}>CRM</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>José Justo</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px', flex: 1 }}>
        {navItems.map(item => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 7,
                border: 'none',
                background: active ? 'var(--bg3)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text3)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={15} color={active ? 'var(--accent)' : 'var(--text3)'} />
                {item.label}
              </span>
              {item.badge != null && (
                <span style={{
                  background: active ? 'var(--accent)' : 'var(--bg4)',
                  color: active ? '#fff' : 'var(--text3)',
                  borderRadius: 20,
                  padding: '1px 7px',
                  fontSize: 11,
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}

        {/* Status por contagem */}
        <div style={{ marginTop: 20, padding: '0 2px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, paddingLeft: 8 }}>Por status</div>
          {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, cfg]) => {
            const count = empresas.filter(e => e.status_prospeccao === key).length
            if (count === 0) return null
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, marginBottom: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Leads totais</span>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{total}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Fechados</span>
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>{fechados}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Contratos ativos</span>
          <span style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 500 }}>{contratosAtivos}</span>
        </div>

        <button
          onClick={onToggleTheme}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '7px 10px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--text3)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {theme === 'light' ? '🌙 Modo escuro' : '☀️ Modo claro'}
        </button>
      </div>
    </aside>
  )
}

function IconGrid({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
    </svg>
  )
}

function IconList({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="2" rx="1" fill={color} opacity="0.9" />
      <rect x="1" y="7" width="14" height="2" rx="1" fill={color} opacity="0.9" />
      <rect x="1" y="11" width="14" height="2" rx="1" fill={color} opacity="0.9" />
    </svg>
  )
}

function IconContract({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke={color} strokeWidth="1.5" opacity="0.9" />
      <rect x="4.5" y="4.5" width="7" height="1.2" rx="0.6" fill={color} opacity="0.9" />
      <rect x="4.5" y="7" width="7" height="1.2" rx="0.6" fill={color} opacity="0.7" />
      <rect x="4.5" y="9.5" width="4" height="1.2" rx="0.6" fill={color} opacity="0.5" />
    </svg>
  )
}
