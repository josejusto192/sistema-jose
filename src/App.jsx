import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { supabase } from './supabase.js'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Leads from './components/Leads.jsx'
import LeadDetail from './components/LeadDetail.jsx'
import Contratos from './components/Contratos.jsx'
import Logs from './components/Logs.jsx'
import Perfil from './components/Perfil.jsx'
import Configuracoes from './components/Configuracoes.jsx'
import Desempenho from './components/Desempenho.jsx'
import Login from './components/Login.jsx'
import { useIsMobile } from './hooks/useIsMobile.js'
import { IconMenu } from './components/Icons.jsx'

export const AppContext = createContext({ theme: 'light', currentUser: '', isSuperAdmin: false, profile: null })
export const useTheme = () => useContext(AppContext).theme
export const useCurrentUser = () => useContext(AppContext).currentUser
export const useIsSuperAdmin = () => useContext(AppContext).isSuperAdmin
export const useProfile = () => useContext(AppContext).profile

// Keep ThemeContext as alias so any existing import still works
export const ThemeContext = AppContext

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [session, setSession] = useState(undefined) // undefined = loading, null = no session
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('dashboard')
  const [selectedLead, setSelectedLead] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [tagFilter, setTagFilter] = useState('')
  const [pendingContrato, setPendingContrato] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const initialLoaded = useRef(false)
  const isMobile = useIsMobile()

  // Theme effect
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }

  // Data loading — only when authenticated
  useEffect(() => {
    if (!session) return
    fetchEmpresas()
    fetchContratos()

    const channel = supabase
      .channel('realtime-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas' }, fetchEmpresas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, fetchContratos)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  async function fetchEmpresas() {
    if (!initialLoaded.current) setLoading(true)
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .order('criado_em', { ascending: false })
    if (!error) setEmpresas(data || [])
    setLoading(false)
    initialLoaded.current = true
  }

  async function fetchContratos() {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .order('criado_em', { ascending: false })
    if (!error) setContratos(data || [])
  }

  // Fire-and-forget log
  function logAction(acao, tabela, registroId, detalhes) {
    if (!session) return
    supabase.from('logs').insert({
      acao,
      tabela,
      registro_id: registroId,
      detalhes,
      usuario_id: session.user.id,
      usuario_nome: profile?.nome || session.user.email || '',
    }).then(() => {})
  }

  // Fire-and-forget status history
  function insertStatusHistory(empresaId, statusAnterior, statusNovo) {
    if (!session) return
    supabase.from('status_history').insert({
      empresa_id: empresaId,
      status_anterior: statusAnterior,
      status_novo: statusNovo,
      usuario_id: session.user.id,
      usuario_nome: profile?.nome || session.user.email || '',
    }).then(() => {})
  }

  async function updateEmpresa(id, updates) {
    const empresa = empresas.find(e => e.id === id)
    const { error } = await supabase.from('empresas').update(updates).eq('id', id)
    if (!error) {
      setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, ...updates }))
      // Log
      logAction('atualizar', 'empresas', id, updates)
      // Status history
      if (updates.status_prospeccao && empresa && updates.status_prospeccao !== empresa.status_prospeccao) {
        insertStatusHistory(id, empresa.status_prospeccao, updates.status_prospeccao)
      }
    }
    return !error
  }

  async function saveContrato(contrato) {
    if (contrato.id) {
      const { id, criado_em, atualizado_em, ...updates } = contrato
      const { error } = await supabase.from('contratos').update(updates).eq('id', id)
      if (!error) {
        setContratos(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
        logAction('atualizar', 'contratos', id, updates)
      }
      return !error
    } else {
      const { id, criado_em, atualizado_em, ...insert } = contrato
      const { data, error } = await supabase.from('contratos').insert(insert).select().single()
      if (!error && data) {
        setContratos(prev => [data, ...prev])
        logAction('criar', 'contratos', data.id, insert)
      }
      return !error
    }
  }

  async function deleteContrato(id) {
    const { error } = await supabase.from('contratos').delete().eq('id', id)
    if (!error) {
      setContratos(prev => prev.filter(c => c.id !== id))
      logAction('deletar', 'contratos', id, {})
    }
    return !error
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setView('dashboard')
    setSelectedLead(null)
    initialLoaded.current = false
    setEmpresas([])
    setContratos([])
  }

  function navigate(v) {
    setView(v)
    setSelectedLead(null)
    if (isMobile) setSidebarOpen(false)
  }

  function openLead(lead) {
    setSelectedLead(lead)
    setView('detail')
    if (isMobile) setSidebarOpen(false)
  }

  function closeLead() {
    setSelectedLead(null)
    setView('leads')
  }

  async function handleCreateContrato(lead) {
    // Who last changed this lead to 'fechou'?
    const { data: hist } = await supabase
      .from('status_history')
      .select('usuario_id, usuario_nome')
      .eq('empresa_id', lead.id)
      .eq('status_novo', 'fechou')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    let vendedor_id = ''
    let vendedor_nome = ''
    let comissao_percentual = 10

    if (hist?.usuario_id) {
      vendedor_id = hist.usuario_id
      vendedor_nome = hist.usuario_nome || ''
      const { data: prof } = await supabase
        .from('profiles')
        .select('comissao_percentual')
        .eq('id', vendedor_id)
        .maybeSingle()
      if (prof?.comissao_percentual != null) comissao_percentual = Number(prof.comissao_percentual)
    }

    setPendingContrato({
      empresa_id:           lead.id,
      cliente_nome:         lead.nome_fantasia || lead.razao_social || '',
      cliente_cnpj:         lead.cnpj || '',
      cliente_email:        lead.email || '',
      cliente_telefone:     lead.telefone || '',
      vendedor_id,
      vendedor_nome,
      comissao_percentual,
    })
    setSelectedLead(null)
    setView('contratos')
  }

  // Derived data for filter
  const allTags = Array.from(new Set(
    empresas.flatMap(e => e.tags || []).filter(Boolean)
  )).sort()

  const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']
  const filteredEmpresas = empresas.filter(e => {
    const matchSearch = !searchQuery ||
      e.razao_social?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.nome_fantasia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.cnpj?.includes(searchQuery) ||
      e.municipio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.cnae_principal_descricao?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchTag = !tagFilter || (e.tags || []).includes(tagFilter)

    if (statusFilter === 'followup') {
      if (!matchSearch || !matchTag) return false
      if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
      const ref = e.atualizado_em || e.criado_em
      if (!ref) return false
      return (Date.now() - new Date(ref)) / 86400000 >= 3
    }
    const matchStatus = statusFilter === 'todos' || e.status_prospeccao === statusFilter
    return matchSearch && matchStatus && matchTag
  })

  const isSuperAdmin = profile?.role === 'superadmin'
  const currentUser = profile?.nome || ''

  async function updateProfile(updates) {
    // Usa RPC SECURITY DEFINER para evitar conflitos de RLS
    const { error } = await supabase.rpc('update_my_profile', {
      p_nome:        updates.nome        ?? profile?.nome        ?? '',
      p_sobrenome:   updates.sobrenome   ?? profile?.sobrenome   ?? '',
      p_bio:         updates.bio         ?? profile?.bio         ?? '',
      p_telefone:    updates.telefone    ?? profile?.telefone    ?? '',
      p_foto_url:    updates.foto_url    ?? profile?.foto_url    ?? null,
      p_cargo:       updates.cargo       ?? profile?.cargo       ?? null,
      p_whatsapp:    updates.whatsapp    ?? profile?.whatsapp    ?? null,
      p_instagram:   updates.instagram   ?? profile?.instagram   ?? null,
      p_meta_mensal: updates.meta_mensal ?? profile?.meta_mensal ?? 5,
      p_tipo_pix:    updates.tipo_pix    ?? profile?.tipo_pix    ?? null,
      p_chave_pix:   updates.chave_pix   ?? profile?.chave_pix   ?? null,
    })
    if (!error) setProfile(prev => ({ ...prev, ...updates }))
    return { ok: !error, errorMsg: error?.message || null }
  }

  const contextValue = { theme, currentUser, isSuperAdmin, profile }

  // Still loading auth state
  if (session === undefined) {
    return (
      <AppContext.Provider value={contextValue}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text3)', fontSize: 13 }}>
          Carregando...
        </div>
      </AppContext.Provider>
    )
  }

  // Not authenticated
  if (!session) {
    return (
      <AppContext.Provider value={contextValue}>
        <Login />
      </AppContext.Provider>
    )
  }

  const sidebarProps = {
    view,
    setView: navigate,
    empresas,
    contratos,
    theme,
    onToggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
    currentUser,
    isSuperAdmin,
    onLogout: handleLogout,
    profile,
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>

        {/* Backdrop mobile */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
          />
        )}

        {/* Sidebar */}
        {isMobile ? (
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
          }}>
            <Sidebar {...sidebarProps} />
          </div>
        ) : (
          <Sidebar {...sidebarProps} />
        )}

        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Barra superior mobile */}
          {isMobile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
            }}>
              <button
                onClick={() => setSidebarOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
              >
                <IconMenu size={20} color="var(--text)" />
              </button>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                Prosp<span style={{ color: 'var(--accent)' }}>CRM</span>
              </span>
            </div>
          )}

          {view === 'dashboard' && (
            <Dashboard
              empresas={empresas}
              contratos={contratos}
              loading={loading}
              onViewLeads={() => navigate('leads')}
              onViewContratos={() => navigate('contratos')}
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
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
              allTags={allTags}
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
              onCreateContrato={handleCreateContrato}
            />
          )}
          {view === 'desempenho' && (
            <Desempenho session={session} profile={profile} contratos={contratos} />
          )}
          {view === 'contratos' && (
            <Contratos
              contratos={contratos}
              empresas={empresas}
              onSave={saveContrato}
              onDelete={deleteContrato}
              pendingContrato={pendingContrato}
              onClearPending={() => setPendingContrato(null)}
            />
          )}
          {view === 'logs' && (
            <Logs isSuperAdmin={isSuperAdmin} />
          )}
          {view === 'perfil' && (
            <Perfil
              profile={profile}
              session={session}
              onUpdateProfile={updateProfile}
            />
          )}
          {view === 'configuracoes' && (
            <Configuracoes session={session} profile={profile} isSuperAdmin={isSuperAdmin} />
          )}
        </main>
      </div>
    </AppContext.Provider>
  )
}
