import React, { useEffect, useMemo, useState } from 'react'
import { AppContext } from '../App.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Dashboard from '../components/Dashboard.jsx'
import Leads from '../components/Leads.jsx'
import LeadDetail from '../components/LeadDetail.jsx'
import Contratos from '../components/Contratos.jsx'
import Agenda from '../components/Agenda.jsx'
import NotificationBell from '../components/NotificationBell.jsx'
import { IconMenu } from '../components/Icons.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'

const profile = {
  id: 'preview-admin',
  nome: 'José',
  sobrenome: 'Justo',
  role: 'superadmin',
  meta_mensal: 8,
}

const leadStatuses = ['novo', 'contatado', 'aguardando', 'respondeu', 'call_agendada', 'proposta_enviada', 'fechou', 'perdido']
const companyNames = [
  'Aurora Arquitetura', 'Norte Studio', 'Vértice Engenharia', 'Caju Tecnologia',
  'Lume Consultoria', 'Ateliê Horizonte', 'Verde Campo', 'Nexo Sistemas',
  'Orbe Logística', 'Casa Nativa', 'Traço Comunicação', 'Ritmo Educação',
]

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

const empresas = companyNames.map((name, index) => ({
  id: `lead-${index + 1}`,
  razao_social: name,
  nome_fantasia: name,
  status_prospeccao: leadStatuses[index % leadStatuses.length],
  criado_em: daysAgo(index * 2),
  municipio: index % 2 ? 'Campinas' : 'São Paulo',
  uf: 'SP',
  vendedor_id: index % 3 === 0 ? 'seller-2' : 'seller-1',
  vendedor_nome: index % 3 === 0 ? 'Marina Costa' : 'Lucas Lima',
  tags: index % 2 ? ['Inbound', 'Prioridade'] : ['Prospecção'],
}))

const contratos = [
  { id: 'contract-1', empresa_id: 'lead-7', cliente_nome: 'Verde Campo', status: 'ativo', pacote: 'growth', valor_mensal: 4800, valor_total: 28800, data_inicio: daysAgo(4).slice(0, 10), vendedor_id: 'seller-1', vendedor_nome: 'Lucas Lima' },
  { id: 'contract-2', empresa_id: 'lead-3', cliente_nome: 'Vértice Engenharia', status: 'ativo', pacote: 'performance', valor_mensal: 3200, valor_total: 19200, data_inicio: daysAgo(18).slice(0, 10), vendedor_id: 'seller-2', vendedor_nome: 'Marina Costa' },
  { id: 'contract-3', empresa_id: 'lead-10', cliente_nome: 'Casa Nativa', status: 'ativo', pacote: 'premium', valor_mensal: 6500, valor_total: 39000, data_inicio: daysAgo(35).slice(0, 10), vendedor_id: 'seller-1', vendedor_nome: 'Lucas Lima' },
  { id: 'contract-4', empresa_id: 'lead-2', cliente_nome: 'Norte Studio', status: 'cancelado', pacote: 'start', valor_mensal: 2100, valor_total: 12600, data_inicio: daysAgo(68).slice(0, 10), vendedor_id: 'seller-2', vendedor_nome: 'Marina Costa' },
]

const tasks = [
  { id: 'task-1', title: 'Retornar proposta', type: 'followup', due_date: new Date().toISOString().slice(0, 10), due_time: '14:30', completed: false, empresa_id: 'lead-6' },
  { id: 'task-2', title: 'Preparar diagnóstico', type: 'call', due_date: daysAgo(-1).slice(0, 10), due_time: '10:00', completed: false, empresa_id: 'lead-4' },
]

const profiles = [
  { id: 'seller-1', nome: 'Lucas', sobrenome: 'Lima', role: 'vendedor' },
  { id: 'seller-2', nome: 'Marina', sobrenome: 'Costa', role: 'vendedor' },
]
const allTags = ['Inbound', 'Prioridade', 'Prospecção']
const allCnaes = []
const notifications = [
  { id: 'notif-1', type: 'novo_lead', title: 'Novo lead atribuído', body: 'Aurora Arquitetura entrou no seu pipeline.', created_at: daysAgo(0), read: false },
  { id: 'notif-2', type: 'followup', title: 'Follow-up para hoje', body: 'Retornar a proposta da Lume Consultoria.', created_at: daysAgo(1), read: true },
]

export default function DesignPreview() {
  const [theme, setTheme] = useState('light')
  const initialView = new URLSearchParams(window.location.search).get('design-preview') || 'dashboard'
  const [view, setView] = useState(initialView === '1' ? 'dashboard' : initialView)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [tagFilter, setTagFilter] = useState('')
  const [cnaeFilter, setCnaeFilter] = useState([])
  const isMobile = useIsMobile()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const contextValue = useMemo(() => ({
    theme,
    currentUser: 'jose@justomidias.com.br',
    isSuperAdmin: true,
    profile,
  }), [theme])

  const sidebar = (
    <Sidebar
      view={view}
      setView={nextView => { setView(nextView); setSidebarOpen(false) }}
      empresas={empresas}
      contratos={contratos}
      tasks={tasks}
      theme={theme}
      onToggleTheme={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
      currentUser="jose@justomidias.com.br"
      isSuperAdmin
      profile={profile}
      bellSlot={(
        <NotificationBell
          notifications={notifications}
          unreadCount={1}
          markRead={() => {}}
          markAllRead={() => {}}
          dropdownAlign="left"
          onNavigate={setView}
        />
      )}
    />
  )

  let previewContent
  if (selectedLead) {
    previewContent = (
      <LeadDetail
        lead={selectedLead}
        onBack={() => setSelectedLead(null)}
        onUpdate={() => {}}
        onCreateContrato={() => setView('contratos')}
        tasks={tasks}
        profiles={profiles}
      />
    )
  } else if (view === 'leads') {
    previewContent = (
      <Leads
        empresas={empresas}
        loading={false}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        allTags={allTags}
        cnaeFilter={cnaeFilter}
        setCnaeFilter={setCnaeFilter}
        allCnaes={allCnaes}
        onOpenLead={setSelectedLead}
        onUpdateEmpresa={() => {}}
        onBulkUpdate={() => {}}
        onBulkDelete={() => {}}
        onCreateLead={() => {}}
        tasks={tasks}
        totalCount={empresas.length}
        profiles={profiles}
      />
    )
  } else if (view === 'contratos') {
    previewContent = (
      <Contratos
        contratos={contratos}
        empresas={empresas}
        onSave={() => {}}
        onDelete={() => {}}
        onClearPending={() => {}}
        onSelectContrato={() => {}}
      />
    )
  } else if (view === 'agenda') {
    previewContent = (
      <Agenda
        tasks={tasks}
        empresas={empresas}
        userId={profile.id}
        profiles={profiles}
        onSave={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
        onOpenLead={setSelectedLead}
      />
    )
  } else {
    previewContent = (
      <Dashboard
        empresas={empresas}
        contratos={contratos}
        tasks={tasks}
        loading={false}
        onViewLeads={() => setView('leads')}
        onViewContratos={() => setView('contratos')}
        onOpenLead={setSelectedLead}
        onNewLead={() => {}}
      />
    )
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell">
        {isMobile && sidebarOpen && (
          <button type="button" className="mobile-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />
        )}
        {isMobile
          ? <div className={`sidebar-drawer ${sidebarOpen ? 'is-open' : 'is-closed'}`}>{sidebar}</div>
          : sidebar}
        <main className="app-main">
          {isMobile && (
            <div className="mobile-topbar">
              <button
                type="button"
                className="mobile-menu-button"
                onClick={() => setSidebarOpen(current => !current)}
                aria-label="Abrir menu"
                aria-expanded={sidebarOpen}
              >
                <IconMenu size={20} color="var(--text)" />
              </button>
              <div className="mobile-brand">
                <img src="/icone.svg" alt="" />
                <span>Visão geral</span>
              </div>
            </div>
          )}
          <div className={`view-frame view-${view}`}>
            {previewContent}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  )
}
