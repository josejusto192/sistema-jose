import React, { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Leads from './components/Leads.jsx'
import LeadDetail from './components/LeadDetail.jsx'

export default function App() {
  const [view, setView] = useState('dashboard')
  const [selectedLead, setSelectedLead] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => {
    fetchEmpresas()
    // realtime subscription
    const channel = supabase
      .channel('empresas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas' }, () => {
        fetchEmpresas()
      })
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

  async function updateEmpresa(id, updates) {
    const { error } = await supabase
      .from('empresas')
      .update(updates)
      .eq('id', id)
    if (!error) {
      setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, ...updates }))
    }
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar
        view={view}
        setView={v => { setView(v); setSelectedLead(null) }}
        empresas={empresas}
      />
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {view === 'dashboard' && (
          <Dashboard
            empresas={empresas}
            loading={loading}
            onViewLeads={() => setView('leads')}
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
          />
        )}
      </main>
    </div>
  )
}
