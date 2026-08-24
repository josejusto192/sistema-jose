import React from 'react'
import { isToday, parseISO } from 'date-fns'
import { STATUS_CONFIG } from '../constants.js'
import { IconGrid, IconList, IconContract, IconClock, IconMoon, IconSun, IconFileText, IconLogOut, IconSettings, IconBarChart, IconUser, IconCalendar, IconSearch, IconLink, IconInbox, IconMail } from './Icons.jsx'

function Avatar({ profile, size = 32 }) {
  const initials = [profile?.nome, profile?.sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  if (profile?.foto_url) return (
    <span className="avatar" style={{ width: size, height: size }}>
      <img src={profile.foto_url} alt="" />
    </span>
  )
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  )
}

function NavBtn({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`nav-button${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-button-main">
        <Icon size={17} color={active ? '#fff9f4' : '#8f9189'} />
        {item.label}
      </span>
      <span className="nav-button-meta">
        {item.alert != null && (
          <span className="nav-alert">{item.alert}</span>
        )}
        {item.badge != null && (
          <span className="nav-count">{item.badge}</span>
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
    { id: 'caixa-entrada',   label: 'Caixa de Entrada', icon: IconInbox },
    { id: 'email-marketing', label: 'Email Marketing', icon: IconMail },
    { id: 'leads',           label: 'Leads',           icon: IconList,     badge: total, alert: followupCount || null },
    { id: 'busca-avancada',  label: 'Busca Avançada',  icon: IconSearch },
    { id: 'contratos',       label: 'Contratos',       icon: IconContract, badge: contratosAtivos || null },
    { id: 'desempenho',      label: 'Equipe',          icon: IconBarChart },
    { id: 'agenda',          label: 'Agenda',          icon: IconCalendar, alert: tasksDueToday || null },
  ]
  const navAdminTools = [
    { id: 'formularios',   label: 'Formulários',   icon: IconLink },
    { id: 'logs',          label: 'Logs',          icon: IconFileText },
    { id: 'configuracoes', label: 'Configurações', icon: IconSettings },
  ]

  const navVendedor = [
    { id: 'dashboard',      label: 'Início',          icon: IconGrid },
    { id: 'caixa-entrada',  label: 'Caixa de Entrada', icon: IconInbox },
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
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <img src="/logo horizontal.svg" alt="Justo Mídias" className="sidebar-logo" />
          {bellSlot}
        </div>
        <div className="sidebar-context">
          {isSuperAdmin ? 'Painel do Admin' : 'Área do Vendedor'}
        </div>
      </div>

      {/* Nav principal */}
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {navItems.map(item => (
          <NavBtn key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
        ))}

        {/* Ferramentas admin */}
        {navSecItems.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Ferramentas</div>
            {navSecItems.map(item => (
              <NavBtn key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
            ))}
          </div>
        )}

        {/* Status por contagem */}
        {statusCounts.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Resumo do pipeline</div>
            {statusCounts.map(({ key, cfg, count }) => (
              <div key={key} className="sidebar-status">
                <div className="sidebar-status-name">
                  <span className="sidebar-status-dot" style={{ background: cfg.dot }} />
                  {cfg.label}
                </div>
                <span>{count}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* User card */}
        <button
          onClick={() => setView('perfil')}
          className={`sidebar-user${view === 'perfil' ? ' is-active' : ''}`}
          aria-label="Abrir meu perfil"
        >
          <Avatar profile={profile} size={32} />
          <div className="sidebar-user-copy">
            <div className="sidebar-user-name">
              {[profile?.nome, profile?.sobrenome].filter(Boolean).join(' ') || currentUser}
            </div>
            <div className={`sidebar-user-role${isSuperAdmin ? ' is-admin' : ''}`}>
              {isSuperAdmin ? 'Admin' : 'Vendedor'}
            </div>
          </div>
        </button>

        <div className="sidebar-actions">
          <button
            onClick={onToggleTheme}
            className="sidebar-action"
            aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
          >
            {theme === 'light' ? <><IconMoon size={13} color="currentColor" /> Escuro</> : <><IconSun size={13} color="currentColor" /> Claro</>}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="sidebar-action"
            >
              <IconLogOut size={13} color="currentColor" /> Sair
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
