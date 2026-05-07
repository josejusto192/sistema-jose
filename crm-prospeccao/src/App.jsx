import React, { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabase.js'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Leads from './components/Leads.jsx'
import LeadDetail from './components/LeadDetail.jsx'
import Contratos from './components/Contratos.jsx'

export const ThemeContext = createContext('light')
export const useTheme = () => useContext(ThemeContext)

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [view, setView] = useState('dashboard')
  const [selectedLead, setSelectedLead] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    fetchEmpresas()
    fetchContratos()

    const channel = supabase
      .channel('realtime-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas' }, fetchEmpresas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, fetchContratos)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchEmpresas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .order('criado_em', { ascending: false })
    if (!error) setEmpresas(data || [])
    setLoading(false)
  }

  async function fetchContratos() {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .order('criado_em', { ascending: false })
    if (!error) setContratos(data || [])
  }

  async function updateEmpresa(id, updates) {
    const { error } = await supabase.from('empresas').update(updates).eq('id', id)
    if (!error) {
      setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, ...updates }))
    }
    return !error
  }

  async function saveContrato(contrato) {
    if (contrato.id) {
      const { id, criado_em, ...updates } = contrato
      const { error } = await supabase.from('contratos').update(updates).eq('id', id)
      if (!error) setContratos(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
      return !error
    } else {
      const { data, error } = await supabase.from('contratos').insert(contrato).select().single()
      if (!error && data) setContratos(prev => [data, ...prev])
      return !error
    }
  }

  async function deleteContrato(id) {
    const { error } = await supabase.from('contratos').delete().eq('id', id)
    if (!error) setContratos(prev => prev.filter(c => c.id !== id))
    return !error
  }

  function openLead(lead) {
    setSelectedLead(lead)
    setView('detail')
  }

  function closeLead() {
    setSelectedLead(null)
    setView('leads')
  }

  const filteredEmpresas = empresas.filter(e => {
    const matchSearch = !searchQuery ||
      e.razao_social?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.nome_fantasia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.cnpj?.includes(searchQuery) ||
      e.municipio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.cnae_principal_descricao?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'todos' || e.status_prospeccao === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <ThemeContext.Provider value={theme}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
        <Sidebar
          view={view}
          setView={v => { setView(v); setSelectedLead(null) }}
          empresas={empresas}
          contratos={contratos}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {view === 'dashboard' && (
            <Dashboard
              empresas={empresas}
              contratos={contratos}
              loading={loading}
              onViewLeads={() => setView('leads')}
              onViewContratos={() => setView('contratos')}
              onOpenLead={openLead}
            />
          )}
          {view === 'leads' && (
            <Leads
              empresas={filteredEmpresas}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onOpenLead={openLead}
              onUpdateEmpresa={updateEmpresa}
              totalCount={empresas.length}
            />
          )}
          {view === 'detail' && selectedLead && (
            <LeadDetail
              lead={selectedLead}
              onBack={closeLead}
              onUpdate={updateEmpresa}
              onSaveContrato={saveContrato}
            />
          )}
          {view === 'contratos' && (
            <Contratos
              contratos={contratos}
              empresas={empresas}
              onSave={saveContrato}
              onDelete={deleteContrato}
            />
          )}
        </main>
      </div>
    </ThemeContext.Provider>
  )
}
