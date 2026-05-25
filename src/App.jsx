import React, { useState, useEffect, useRef, createContext, useContext, useMemo } from 'react'
import { leadName } from './constants.js'
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
import Agenda from './components/Agenda.jsx'
import BuscaAvancada from './components/BuscaAvancada.jsx'
import Login from './components/Login.jsx'
import { useIsMobile } from './hooks/useIsMobile.js'
import { IconMenu } from './components/Icons.jsx'
import { notify } from './lib/notifications.js'
import { useNotifications } from './hooks/useNotifications.js'
import NotificationBell from './components/NotificationBell.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'

export const AppContext = createContext({ theme: 'light', currentUser: '', isSuperAdmin: false, profile: null })
export const useTheme = () => useContext(AppContext).theme
export const useCurrentUser = () => useContext(AppContext).currentUser
export const useIsSuperAdmin = () => useContext(AppContext).isSuperAdmin
export const useProfile = () => useContext(AppContext).profile

// Keep ThemeContext as alias so any existing import still works
export const ThemeContext = AppContext

const TASK_DUE_CHECK_KEY = 'tilim_task_due_checked'

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '') || 'dashboard'
  const parts = hash.split('/').filter(Boolean)
  const section = parts[0] || 'dashboard'
  if (section === 'leads'     && parts[1]) return { view: 'detail',    leadId: parts[1],    contratoId: null }
  if (section === 'contratos' && parts[1]) return { view: 'contratos', leadId: null,         contratoId: parts[1] }
  return { view: section, leadId: null, contratoId: null }
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [session, setSession] = useState(undefined) // undefined = loading, null = no session
  const [profile, setProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [route, setRoute] = useState(parseHash)
  const view       = route.view
  const leadId     = route.leadId
  const contratoId = route.contratoId
  const [empresas, setEmpresas] = useState([])
  const selectedLead = useMemo(
    () => (view === 'detail' && leadId ? empresas.find(e => e.id === leadId) ?? null : null),
    [view, leadId, empresas]
  )
  const [contratos, setContratos] = useState([])
  const selectedContrato = useMemo(
    () => (contratoId ? contratos.find(c => c.id === contratoId) ?? null : null),
    [contratoId, contratos]
  )
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [tagFilter, setTagFilter] = useState('')
  const [cnaeFilter, setCnaeFilter] = useState([])
  const [pendingContrato, setPendingContrato] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const initialLoaded = useRef(false)
  const isMobile = useIsMobile()

  // Theme effect
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  // Hash-based routing
  useEffect(() => {
    function onHashChange() { setRoute(parseHash()) }
    window.addEventListener('hashchange', onHashChange)
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(null, '', '#/dashboard')
    }
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Register Service Worker for push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

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
    setProfileLoaded(true)
    if (data?.role !== 'superadmin' && !localStorage.getItem('tilim_onboarding_done_' + userId)) {
      setShowOnboarding(true)
    }
  }

  // Fetch all profiles for superadmin (needed for Agenda user labels)
  useEffect(() => {
    if (!profileLoaded || profile?.role !== 'superadmin') return
    supabase.from('profiles').select('id, nome, sobrenome').then(({ data }) => {
      setProfiles(data || [])
    })
  }, [profileLoaded, profile?.role])

  // Data loading — aguarda perfil para aplicar filtro por role
  useEffect(() => {
    if (!session || !profileLoaded) return

    const isAdmin = profile?.role === 'superadmin'
    const userId  = session.user.id

    async function loadLeads() {
      if (!initialLoaded.current) setLoading(true)
      let q = supabase.from('leads').select('*').order('criado_em', { ascending: false })
      if (!isAdmin) q = q.eq('vendedor_id', userId)
      const { data } = await q
      if (data) setEmpresas(data)
      setLoading(false)
      initialLoaded.current = true
    }

    async function loadContratos() {
      let q = supabase.from('contratos').select('*').order('criado_em', { ascending: false })
      if (!isAdmin) q = q.eq('vendedor_id', userId)
      const { data } = await q
      if (data) setContratos(data)
    }

    loadLeads()
    loadContratos()

    const channel = supabase
      .channel('realtime-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, loadLeads)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, loadContratos)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session?.user?.id, profileLoaded, profile?.role])

  // Tasks — carrega e assina realtime após perfil estar disponível (filtro por role)
  useEffect(() => {
    if (!session || !profileLoaded) return

    const isAdmin = profile?.role === 'superadmin'
    const userId  = session.user.id

    async function loadTasks() {
      let q = supabase.from('tasks').select('*').order('due_date', { ascending: true })
      if (!isAdmin) q = q.eq('user_id', userId)
      const { data, error } = await q
      if (!error) setTasks(data || [])
    }

    loadTasks()

    const cfg = { event: '*', schema: 'public', table: 'tasks' }
    if (!isAdmin) cfg.filter = `user_id=eq.${userId}`

    const taskChannel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', cfg, loadTasks)
      .subscribe()

    return () => supabase.removeChannel(taskChannel)
  }, [session?.user?.id, profileLoaded, profile?.role])

  // Daily task due notification check
  useEffect(() => {
    if (!session || !tasks.length) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(TASK_DUE_CHECK_KEY) === today) return

    const due = tasks.filter(t =>
      !t.completed &&
      t.due_date <= today &&
      t.user_id === session.user.id
    )

    if (due.length > 0) {
      notify.taskDue(due.length, due.map(t => t.title), session.user.id)
      localStorage.setItem(TASK_DUE_CHECK_KEY, today)
    }
  }, [tasks, session])

  async function saveTask(task) {
    if (task.id) {
      const { id, created_at, ...updates } = task
      const { data, error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (!error && data) {
        setTasks(prev => prev.map(t => t.id === id ? data : t))
        logAction('atualizar', 'tasks', id, { title: task.title, type: task.type, due_date: task.due_date, empresa_nome: task.empresa_nome || null })
      }
    } else {
      const { data, error } = await supabase.from('tasks').insert(task).select().single()
      if (!error && data) {
        setTasks(prev => [...prev, data].sort((a, b) => a.due_date.localeCompare(b.due_date)))
        logAction('criar', 'tasks', data.id, { title: data.title, type: data.type, due_date: data.due_date, empresa_nome: data.empresa_nome || null })
      }
    }
  }

  async function deleteTask(id) {
    const task = tasks.find(t => t.id === id)
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id))
      logAction('deletar', 'tasks', id, { title: task?.title, empresa_nome: task?.empresa_nome || null })
    }
  }

  async function toggleTask(task) {
    const completed = !task.completed
    const updates = { completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
    const { error } = await supabase.from('tasks').update(updates).eq('id', task.id)
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed, completed_at: task.completed_at, updated_at: task.updated_at } : t))
    } else {
      logAction(completed ? 'concluir' : 'reabrir', 'tasks', task.id, { title: task.title, empresa_nome: task.empresa_nome || null })
    }
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
    const { error } = await supabase.from('leads').update(updates).eq('id', id)
    if (!error) {
      setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      logAction('atualizar', 'leads', id, updates)
      if (updates.status_prospeccao && empresa && updates.status_prospeccao !== empresa.status_prospeccao) {
        insertStatusHistory(id, empresa.status_prospeccao, updates.status_prospeccao)
        // Notify: lead fechou
        if (updates.status_prospeccao === 'fechou') {
          const nome = leadName(empresa)
          // Fetch superadmin IDs to notify them
          supabase.from('profiles').select('id').eq('role', 'superadmin').then(({ data: admins }) => {
            const adminIds = (admins || []).map(a => a.id)
            const recipients = [...new Set([...adminIds, session.user.id])]
            notify.leadFechou(nome, recipients)
          })
        }
      }
    }
    return !error
  }

  async function createEmpresa(data) {
    const { data: created, error } = await supabase
      .from('leads')
      .insert(data)
      .select()
      .single()
    if (!error && created) {
      setEmpresas(prev => [created, ...prev])
      logAction('criar', 'leads', created.id, {
        nome_fantasia: created.nome_fantasia,
        razao_social: created.razao_social,
        nome: created.nome,
        tipo: created.tipo,
        origem: created.origem,
      })
    }
    return { ok: !error }
  }

  async function bulkUpdateEmpresas(ids, updates) {
    const { error } = await supabase.from('leads').update(updates).in('id', ids)
    if (!error) {
      setEmpresas(prev => prev.map(e => ids.includes(e.id) ? { ...e, ...updates } : e))
      logAction('atualizar', 'leads', `bulk:${ids.length}`, updates)
    }
    return !error
  }

  async function bulkDeleteEmpresas(ids) {
    const { error } = await supabase.from('leads').delete().in('id', ids)
    if (!error) {
      setEmpresas(prev => prev.filter(e => !ids.includes(e.id)))
      logAction('deletar', 'leads', `bulk:${ids.length}`, { count: ids.length })
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
        // Notify vendor when commission is marked as paid
        if (updates.comissao_status === 'paga' && updates.vendedor_id && updates.comissao_valor > 0) {
          notify.comissaoPaga(updates.vendedor_id, updates.cliente_nome || '', updates.comissao_valor)
        }
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
    window.location.hash = '/dashboard'
    initialLoaded.current = false
    setEmpresas([])
    setContratos([])
    setTasks([])
    setProfile(null)
    setProfileLoaded(false)
  }

  function navigate(v) {
    window.location.hash = '/' + v
    if (isMobile) setSidebarOpen(false)
  }

  function openLead(lead) {
    window.location.hash = '/leads/' + lead.id
    if (isMobile) setSidebarOpen(false)
  }

  function closeLead() {
    window.location.hash = '/leads'
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
      cliente_nome:         leadName(lead),
      cliente_cnpj:         lead.cnpj || '',
      cliente_email:        lead.email || '',
      cliente_telefone:     lead.telefone || '',
      vendedor_id,
      vendedor_nome,
      comissao_percentual,
    })
    navigate('contratos')
  }

  // Derived data for filter
  const allTags = Array.from(new Set(
    empresas.flatMap(e => e.tags || []).filter(Boolean)
  )).sort()

  const allCnaes = Array.from(new Set(
    empresas.map(e => e.cnae_principal_descricao).filter(Boolean)
  )).sort()

  const filteredEmpresas = empresas.filter(e => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !searchQuery ||
      e.razao_social?.toLowerCase().includes(q) ||
      e.nome_fantasia?.toLowerCase().includes(q) ||
      e.nome?.toLowerCase().includes(q) ||
      e.sobrenome?.toLowerCase().includes(q) ||
      e.cnpj?.includes(searchQuery) ||
      e.municipio?.toLowerCase().includes(q) ||
      e.cnae_principal_descricao?.toLowerCase().includes(q)

    const matchTag  = !tagFilter || (e.tags || []).includes(tagFilter)
    const matchCnae = cnaeFilter.length === 0 || cnaeFilter.includes(e.cnae_principal_descricao)

    if (statusFilter === 'followup') {
      if (!matchSearch || !matchTag || !matchCnae) return false
      const today = new Date().toISOString().slice(0, 10)
      return tasks.some(t => t.empresa_id === e.id && !t.completed && t.due_date <= today)
    }
    const matchStatus = statusFilter === 'todos' || e.status_prospeccao === statusFilter
    return matchSearch && matchStatus && matchTag && matchCnae
  })

  const isSuperAdmin = profile?.role === 'superadmin'
  const currentUser = profile?.nome || ''
  const notif = useNotifications(session?.user?.id)

  async function updateProfile(updates) {
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
    if (!error) {
      setProfile(prev => ({ ...prev, ...updates }))
      logAction('atualizar', 'perfil', session.user.id, { nome: updates.nome, sobrenome: updates.sobrenome, cargo: updates.cargo })
    }
    return { ok: !error, errorMsg: error?.message || null }
  }

  const contextValue = { theme, currentUser, isSuperAdmin, profile }

  if (session === undefined) {
    return (
      <AppContext.Provider value={contextValue}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text3)', fontSize: 13 }}>
          Carregando...
        </div>
      </AppContext.Provider>
    )
  }

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
    tasks,
    theme,
    onToggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
    currentUser,
    isSuperAdmin,
    onLogout: handleLogout,
    profile,
    bellSlot: (
      <NotificationBell
        notifications={notif.notifications}
        unreadCount={notif.unreadCount}
        markRead={notif.markRead}
        markAllRead={notif.markAllRead}
        dropdownAlign="left"
        onNavigate={navigate}
      />
    ),
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
              <img src="/icone.svg" alt="Justo CRM" style={{ height: 26 }} />
              <div style={{ marginLeft: 'auto' }}>
                <NotificationBell
                  notifications={notif.notifications}
                  unreadCount={notif.unreadCount}
                  markRead={notif.markRead}
                  markAllRead={notif.markAllRead}
                  onNavigate={navigate}
                />
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <Dashboard
              empresas={empresas}
              contratos={contratos}
              tasks={tasks}
              loading={loading}
              onViewLeads={() => navigate('leads')}
              onViewContratos={() => navigate('contratos')}
              onOpenLead={openLead}
              onNewLead={() => navigate('leads')}
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
              cnaeFilter={cnaeFilter}
              setCnaeFilter={setCnaeFilter}
              allCnaes={allCnaes}
              onOpenLead={openLead}
              onUpdateEmpresa={updateEmpresa}
              onBulkUpdate={bulkUpdateEmpresas}
              onBulkDelete={bulkDeleteEmpresas}
              onCreateLead={createEmpresa}
              tasks={tasks}
              totalCount={empresas.length}
            />
          )}
          {view === 'detail' && selectedLead && (
            <LeadDetail
              lead={selectedLead}
              onBack={closeLead}
              onUpdate={updateEmpresa}
              onCreateContrato={handleCreateContrato}
              tasks={tasks.filter(t => t.empresa_id === selectedLead.id)}
              contratos={contratos.filter(c => c.empresa_id === selectedLead.id)}
              onSaveTask={saveTask}
              onDeleteTask={deleteTask}
              onToggleTask={toggleTask}
              userId={session?.user?.id}
              empresas={empresas}
            />
          )}
          {view === 'agenda' && (
            <Agenda
              tasks={tasks}
              empresas={empresas}
              userId={session?.user?.id}
              profiles={profiles}
              onSave={saveTask}
              onDelete={deleteTask}
              onToggle={toggleTask}
              onOpenLead={openLead}
            />
          )}
          {view === 'busca-avancada' && (
            <BuscaAvancada
              onCreateLead={createEmpresa}
              existingCnpjs={empresas.map(e => (e.cnpj || '').replace(/\D/g, '')).filter(Boolean)}
              profiles={profiles}
            />
          )}
          {view === 'desempenho' && (
            <Desempenho session={session} profile={profile} contratos={contratos} empresas={empresas} />
          )}
          {view === 'contratos' && (
            <Contratos
              contratos={contratos}
              empresas={empresas}
              onSave={saveContrato}
              onDelete={deleteContrato}
              pendingContrato={pendingContrato}
              onClearPending={() => setPendingContrato(null)}
              selectedContrato={selectedContrato}
              onSelectContrato={id => { window.location.hash = id ? '/contratos/' + id : '/contratos' }}
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
            <Configuracoes session={session} profile={profile} isSuperAdmin={isSuperAdmin} logAction={logAction} />
          )}
        </main>
      </div>

      {showOnboarding && session && (
        <OnboardingModal userId={session.user.id} onClose={() => setShowOnboarding(false)} />
      )}
    </AppContext.Provider>
  )
}
