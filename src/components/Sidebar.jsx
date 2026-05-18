import React from 'react'
import { differenceInDays } from 'date-fns'
import { STATUS_CONFIG } from '../constants.js'
import { IconGrid, IconList, IconContract, IconClock, IconMoon, IconSun, IconFileText, IconLogOut, IconSettings, IconBarChart, IconUser } from './Icons.jsx'

function Avatar({ profile, size = 32 }) {
  const initials = [profile?.nome, profile?.sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  if (profile?.foto_url) return <img src={profile.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#00CB53', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']

const S = {
  sidebar: { width: 220, background: '#0F1115', borderRight: '1px solid #1A1F25', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' },
  logo: { padding: '18px 18px 14px', borderBottom: '1px solid #1A1F25' },
  nav: { padding: '8px 8px', flex: 1, overflowY: 'auto' },
  section: { marginTop: 16, paddingTop: 14, borderTop: '1px solid #1A1F25' },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 10, marginBottom: 6 },
  footer: { padding: '10px 12px 14px', borderTop: '1px solid #1A1F25' },
}

function NavBtn({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '7px 10px', borderRadius: 5, border: 'none',
        background: active ? '#1A1F25' : 'transparent',
        color: active ? '#F1F5F9' : '#64748B',
        fontSize: 13, fontWeight: active ? 500 : 400,
        cursor: 'pointer', marginBottom: 1, transition: 'background 0.1s, color 0.1s', textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={14} color={active ? '#00CB53' : '#475569'} />
        {item.label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {item.alert != null && (
          <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 3, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>
            {item.alert}
          </span>
        )}
        {item.badge != null && (
          <span style={{ background: active ? '#2563EB' : '#1A1F25', color: active ? '#fff' : '#64748B', borderRadius: 3, padding: '1px 6px', fontSize: 10 }}>
            {item.badge}
          </span>
        )}
      </span>
    </button>
  )
}

export default function Sidebar({ view, setView, empresas, contratos, theme, onToggleTheme, currentUser, isSuperAdmin, onLogout, profile }) {
  const total = empresas.length
  const fechados = empresas.filter(e => e.status_prospeccao === 'fechou').length
  const followupCount = empresas.filter(e => {
    if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
    const ref = e.atualizado_em || e.criado_em
    if (!ref) return false
    return differenceInDays(new Date(), new Date(ref)) >= 3
  }).length

  const contratosAtivos = contratos.filter(c => c.status === 'ativo').length
  const minhasComissoesPendentes = !isSuperAdmin
    ? contratos.filter(c => c.vendedor_id === profile?.id && c.comissao_status === 'pendente' && (c.comissao_valor || 0) > 0).length
    : 0

  /* ── NAV POR PERFIL ─────────────────────────────── */
  const navAdmin = [
    { id: 'dashboard',  label: 'Dashboard',      icon: IconGrid },
    { id: 'leads',      label: 'Leads',           icon: IconList,     badge: total, alert: followupCount || null },
    { id: 'contratos',  label: 'Contratos',       icon: IconContract, badge: contratosAtivos || null },
    { id: 'desempenho', label: 'Equipe',           icon: IconBarChart },
  ]
  const navAdminTools = [
    { id: 'logs',          label: 'Logs',          icon: IconFileText },
    { id: 'configuracoes', label: 'Configurações', icon: IconSettings },
  ]

  const navVendedor = [
    { id: 'dashboard',  label: 'Início',           icon: IconGrid },
    { id: 'leads',      label: 'Meus Leads',        icon: IconList, badge: total, alert: followupCount || null },
    { id: 'contratos',  label: 'Meus Contratos',    icon: IconContract, badge: minhasComissoesPendentes || null },
    { id: 'desempenho', label: 'Meu Desempenho',    icon: IconBarChart },
    { id: 'perfil',     label: 'Meu Perfil',        icon: IconUser },
  ]

  const navItems    = isSuperAdmin ? navAdmin     : navVendedor
  const navSecItems = isSuperAdmin ? navAdminTools : []

  const statusCounts = Object.entries(STATUS_CONFIG)
    .map(([key, cfg]) => ({ key, cfg, count: empresas.filter(e => e.status_prospeccao === key).length }))
    .filter(s => s.count > 0)

  const footerStats = isSuperAdmin
    ? [
        { label: 'Leads',      value: total,          color: '#3B82F6' },
        { label: 'Fechados',   value: fechados,        color: '#10B981' },
        { label: 'Contratos',  value: contratosAtivos, color: '#8B5CF6' },
        { label: 'Follow-up',  value: followupCount,   color: '#F59E0B' },
      ]
    : [
        { label: 'Meus leads',    value: total,                    color: '#3B82F6' },
        { label: 'Follow-up',     value: followupCount,            color: '#F59E0B' },
        { label: 'Fechamentos',   value: fechados,                 color: '#10B981' },
        { label: 'Com. abertas',  value: minhasComissoesPendentes, color: '#8B5CF6' },
      ]

  return (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={S.logo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="28" height="28" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="56" height="56" rx="12" fill="#00CB53" fillOpacity="0.12"/>
            <path d="M28 10C21.373 10 16 15.373 16 22v2.5C13.791 25.674 12 27.8 12 30.5v2a3 3 0 0 0 2 2.83V36a8 8 0 0 0 8 8h.17A4.002 4.002 0 0 0 28 46a4.002 4.002 0 0 0 7.83-2H36a8 8 0 0 0 8-8v-.17A3 3 0 0 0 46 32.5v-2c0-2.7-1.791-4.826-4-5.998V22C42 15.373 36.627 10 28 10z" fill="#00CB53" opacity="0.2"/>
            <path d="M28 12C22.477 12 18 16.477 18 22v2.815A6.5 6.5 0 0 0 13.5 31v1.5a3 3 0 0 0 2 2.83V36a8 8 0 0 0 8 8h.17A4.002 4.002 0 0 0 36 44h.33a8 8 0 0 0 8-8v-1.67A3 3 0 0 0 46.5 32.5V31A6.5 6.5 0 0 0 38 24.815V22C38 16.477 33.523 12 28 12z" stroke="#00CB53" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M23 13.5C23 13.5 24.8 12 28 12s5 1.5 5 1.5" stroke="#00CB53" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
            <circle cx="41" cy="15" r="3" fill="#00CB53"/>
            <circle cx="44" cy="10" r="2" fill="#00CB53" opacity="0.5"/>
          </svg>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px', color: '#F5F7FA', fontFamily: "'Satoshi', 'Inter', sans-serif", lineHeight: 1 }}>
              Tilim
            </div>
            <div style={{ fontSize: 9, color: '#00CB53', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
              O Som da Venda
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 8 }}>
          {isSuperAdmin ? 'Painel do Admin' : 'Área do Vendedor'}
        </div>
      </div>

      {/* Nav principal */}
      <nav style={S.nav}>
        {navItems.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
        ))}

        {/* Ferramentas admin */}
        {navSecItems.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionLabel}>Ferramentas</div>
            {navSecItems.map(item => (
              <NavBtn key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
            ))}
          </div>
        )}

        {/* Status por contagem */}
        {statusCounts.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionLabel}>Por status</div>
            {statusCounts.map(({ key, cfg, count }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', marginBottom: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#64748B' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </div>
                <span style={{ fontSize: 11, color: '#475569' }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div style={S.footer}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
          {footerStats.map(s => (
            <div key={s.label} style={{ background: '#1A1F25', borderRadius: 4, padding: '6px 8px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* User card */}
        <button
          onClick={() => setView('perfil')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginBottom: 6,
            padding: '7px 8px', background: view === 'perfil' ? '#1A1F25' : '#0F1115',
            border: '1px solid #1A1F25', borderRadius: 5, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Avatar profile={profile} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[profile?.nome, profile?.sobrenome].filter(Boolean).join(' ') || currentUser}
            </div>
            <div style={{ fontSize: 10, color: isSuperAdmin ? '#00CB53' : '#475569', fontWeight: 600, marginTop: 1 }}>
              {isSuperAdmin ? 'superadmin' : 'vendedor'}
            </div>
          </div>
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onToggleTheme}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 5, border: '1px solid #1A1F25', background: 'transparent', color: '#475569', fontSize: 11, cursor: 'pointer' }}
          >
            {theme === 'light' ? <><IconMoon size={12} color="#475569" /> Escuro</> : <><IconSun size={12} color="#475569" /> Claro</>}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 5, border: '1px solid #1A1F25', background: 'transparent', color: '#475569', fontSize: 11, cursor: 'pointer' }}
            >
              <IconLogOut size={12} color="#475569" /> Sair
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
