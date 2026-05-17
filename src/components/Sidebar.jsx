import React from 'react'
import { differenceInDays } from 'date-fns'
import { STATUS_CONFIG } from '../constants.js'
import { IconGrid, IconList, IconContract, IconClock, IconMoon, IconSun, IconFileText, IconLogOut, IconSettings, IconBarChart, IconUser } from './Icons.jsx'

function Avatar({ profile, size = 40 }) {
  const initials = [profile?.nome, profile?.sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  if (profile?.foto_url) return <img src={profile.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']

export default function Sidebar({ view, setView, empresas, contratos, theme, onToggleTheme, currentUser, isSuperAdmin, onLogout, profile }) {
  const total = empresas.length
  const fechados = empresas.filter(e => e.status_prospeccao === 'fechou').length
  const contratosAtivos = contratos.filter(c => c.status === 'ativo').length
  const followupCount = empresas.filter(e => {
    if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
    const ref = e.atualizado_em || e.criado_em
    if (!ref) return false
    return differenceInDays(new Date(), new Date(ref)) >= 3
  }).length

  const navItems = [
    { id: 'dashboard',    label: 'Dashboard',     icon: IconGrid },
    { id: 'leads',        label: 'Leads',         icon: IconList,     badge: total, alert: followupCount || null },
    { id: 'desempenho',   label: 'Desempenho',    icon: IconBarChart },
    { id: 'contratos',    label: 'Contratos',     icon: IconContract, badge: contratosAtivos || null },
    { id: 'perfil',       label: 'Meu Perfil',    icon: IconUser },
    ...(isSuperAdmin ? [
      { id: 'logs',          label: 'Logs',          icon: IconFileText },
      { id: 'configuracoes', label: 'Configurações',  icon: IconSettings },
    ] : []),
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.alert != null && (
                  <span style={{
                    background: '#F59E0B',
                    color: '#fff',
                    borderRadius: 20,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {item.alert}
                  </span>
                )}
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
              </span>
            </button>
          )
        })}

        {/* Status por contagem */}
        <div style={{ marginTop: 20, padding: '0 2px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, paddingLeft: 8 }}>Por status</div>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Contratos ativos</span>
          <span style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 500 }}>{contratosAtivos}</span>
        </div>
        {followupCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '4px 8px', background: '#FFFBEB', borderRadius: 6, border: '1px solid #F59E0B40' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#B45309' }}>
              <IconClock size={13} color="#B45309" /> Follow-up
            </span>
            <span style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>{followupCount}</span>
          </div>
        ) : (
          <div style={{ marginBottom: 10 }} />
        )}

        {/* Usuário logado — clicável, navega para perfil */}
        {currentUser && (
          <button
            onClick={() => setView('perfil')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              marginBottom: 8,
              padding: '6px 8px',
              background: view === 'perfil' ? 'var(--bg4)' : 'var(--bg3)',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s',
            }}
          >
            <Avatar profile={profile} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[profile?.nome, profile?.sobrenome].filter(Boolean).join(' ') || currentUser}
              </div>
              <div style={{ fontSize: 10, color: isSuperAdmin ? 'var(--accent)' : 'var(--text3)', fontWeight: 600, marginTop: 1 }}>
                {isSuperAdmin ? 'superadmin' : 'vendedor'}
              </div>
            </div>
          </button>
        )}

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
            marginBottom: 6,
          }}
        >
          {theme === 'light'
            ? <><IconMoon size={13} color="var(--text3)" /> Modo escuro</>
            : <><IconSun  size={13} color="var(--text3)" /> Modo claro</>
          }
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '7px 10px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text3)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <IconLogOut size={13} color="var(--text3)" /> Sair
          </button>
        )}
      </div>
    </aside>
  )
}
