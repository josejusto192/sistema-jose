import React from 'react'
import { isToday, parseISO } from 'date-fns'
import { STATUS_CONFIG } from '../constants.js'
import { IconGrid, IconList, IconContract, IconClock, IconMoon, IconSun, IconFileText, IconLogOut, IconSettings, IconBarChart, IconUser, IconCalendar, IconSearch } from './Icons.jsx'

function Avatar({ profile, size = 32 }) {
  const initials = [profile?.nome, profile?.sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  if (profile?.foto_url) return <img src={profile.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#F05B17', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}


const S = {
  sidebar: { width: 228, background: '#0E0F10', borderRight: '1px solid #1A1F25', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' },
  logo: { padding: '20px 18px 16px', borderBottom: '1px solid #1A1F25' },
  nav: { padding: '10px 10px', flex: 1, overflowY: 'auto' },
  section: { marginTop: 18, paddingTop: 14, borderTop: '1px solid #1A1F25' },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: '#3D4A5C', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 10, marginBottom: 6 },
  footer: { padding: '10px 12px 14px', borderTop: '1px solid #1A1F25' },
}

function NavBtn({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none',
        background: active ? '#F05B17' : 'transparent',
        color: active ? '#fff' : '#8896A9',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer', marginBottom: 2, transition: 'background 0.15s, color 0.15s', textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon size={15} color={active ? '#fff' : '#4D5E73'} />
        {item.label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {item.alert != null && (
          <span style={{ background: active ? 'rgba(255,255,255,0.25)' : '#F59E0B', color: '#fff', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>
            {item.alert}
          </span>
        )}
        {item.badge != null && (
          <span style={{ background: active ? 'rgba(255,255,255,0.2)' : '#1A1F25', color: active ? '#fff' : '#64748B', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>
            {item.badge}
          </span>
        )}
      </span>
    </button>
  )
}

export default function Sidebar({ view, setView, empresas, contratos, tasks = [], theme, onToggleTheme, currentUser, isSuperAdmin, onLogout, profile, bellSlot }) {
  const total = empresas.length
  const today = new Date().toISOString().slice(0, 10)
  const followupCount = tasks.filter(t => !t.completed && t.due_date <= today).length

  const contratosAtivos = contratos.filter(c => c.status === 'ativo').length
  const minhasComissoesPendentes = !isSuperAdmin
    ? contratos.filter(c => c.vendedor_id === profile?.id && c.comissao_status === 'pendente' && (c.comissao_valor || 0) > 0).length
    : 0
  const tasksDueToday = tasks.filter(t => !t.completed && isToday(parseISO(t.due_date))).length

  const navAdmin = [
    { id: 'dashboard',       label: 'Dashboard',      icon: IconGrid },
    { id: 'leads',           label: 'Leads',           icon: IconList,     badge: total, alert: followupCount || null },
    { id: 'busca-avancada',  label: 'Busca Avançada',  icon: IconSearch },
    { id: 'contratos',       label: 'Contratos',       icon: IconContract, badge: contratosAtivos || null },
    { id: 'desempenho',      label: 'Equipe',          icon: IconBarChart },
    { id: 'agenda',          label: 'Agenda',          icon: IconCalendar, alert: tasksDueToday || null },
  ]
  const navAdminTools = [
    { id: 'logs',          label: 'Logs',          icon: IconFileText },
    { id: 'configuracoes', label: 'Configurações', icon: IconSettings },
  ]

  const navVendedor = [
    { id: 'dashboard',      label: 'Início',          icon: IconGrid },
    { id: 'leads',          label: 'Meus Leads',      icon: IconList, badge: total, alert: followupCount || null },
    { id: 'busca-avancada', label: 'Busca Avançada',  icon: IconSearch },
    { id: 'contratos',      label: 'Meus Contratos',  icon: IconContract, badge: minhasComissoesPendentes || null },
    { id: 'desempenho',     label: 'Meu Desempenho',  icon: IconBarChart },
    { id: 'agenda',         label: 'Agenda',          icon: IconCalendar, alert: tasksDueToday || null },
    { id: 'perfil',         label: 'Meu Perfil',      icon: IconUser },
  ]

  const navItems    = isSuperAdmin ? navAdmin     : navVendedor
  const navSecItems = isSuperAdmin ? navAdminTools : []

  const statusCounts = Object.entries(STATUS_CONFIG)
    .map(([key, cfg]) => ({ key, cfg, count: empresas.filter(e => e.status_prospeccao === key).length }))
    .filter(s => s.count > 0)

  return (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={S.logo}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo horizontal.svg" alt="Justo Mídias" style={{ height: 32 }} />
          </div>
          {bellSlot}
        </div>
        <div style={{ fontSize: 10, color: '#3D4A5C', marginTop: 10, fontWeight: 500 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#4D5E73' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </div>
                <span style={{ fontSize: 11, color: '#3D4A5C' }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div style={S.footer}>
        {/* User card */}
        <button
          onClick={() => setView('perfil')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginBottom: 6,
            padding: '7px 8px', background: view === 'perfil' ? '#1A1F25' : 'transparent',
            border: '1px solid #1A1F25', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Avatar profile={profile} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[profile?.nome, profile?.sobrenome].filter(Boolean).join(' ') || currentUser}
            </div>
            <div style={{ fontSize: 10, color: isSuperAdmin ? '#F05B17' : '#3D4A5C', fontWeight: 600, marginTop: 1 }}>
              {isSuperAdmin ? 'Admin' : 'Vendedor'}
            </div>
          </div>
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onToggleTheme}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 6, border: '1px solid #1A1F25', background: 'transparent', color: '#3D4A5C', fontSize: 11, cursor: 'pointer' }}
          >
            {theme === 'light' ? <><IconMoon size={12} color="#3D4A5C" /> Escuro</> : <><IconSun size={12} color="#3D4A5C" /> Claro</>}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 6, border: '1px solid #1A1F25', background: 'transparent', color: '#3D4A5C', fontSize: 11, cursor: 'pointer' }}
            >
              <IconLogOut size={12} color="#3D4A5C" /> Sair
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
