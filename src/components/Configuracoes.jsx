import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function Avatar({ profile, size = 40 }) {
  const initials = [profile?.nome, profile?.sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  if (profile?.foto_url) return <img src={profile.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function Badge({ children, color, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 3, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {children}
    </span>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />
}

function inp(extra = {}) {
  return {
    width: '100%', padding: '8px 11px', borderRadius: 5,
    border: '1px solid var(--border)', background: 'var(--bg3)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    ...extra,
  }
}

/* ─── Modal de usuário ────────────────────────────────────────────────────── */

function UserModal({ user, currentUserId, onClose, onSaved }) {
  const isSelf = user.id === currentUserId
  const [nome,       setNome]       = useState(user.nome       || '')
  const [sobrenome,  setSobrenome]  = useState(user.sobrenome  || '')
  const [cargo,      setCargo]      = useState(user.cargo      || '')
  const [comissao,   setComissao]   = useState(user.comissao_percentual ?? 10)
  const [role,       setRole]       = useState(user.role       || 'vendedor')
  const [ativo,      setAtivo]      = useState(user.ativo !== false)
  const [saving,     setSaving]     = useState(false)
  const [resetting,  setResetting]  = useState(false)
  const [error,      setError]      = useState(null)
  const [ok,         setOk]         = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)

  async function handleSave() {
    setSaving(true); setError(null); setOk(null)
    const { error: err } = await supabase.from('profiles').update({
      nome, sobrenome, cargo,
      comissao_percentual: Number(comissao) || 0,
      role,
      ativo,
    }).eq('id', user.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setOk('Salvo com sucesso!')
    onSaved({ ...user, nome, sobrenome, cargo, comissao_percentual: Number(comissao), role, ativo })
    setTimeout(() => setOk(null), 2500)
  }

  async function handleResetSenha() {
    if (!user.email) return
    setResetting(true); setError(null); setOk(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    })
    setResetting(false)
    if (err) { setError(err.message); return }
    setOk(`E-mail de redefinição enviado para ${user.email}`)
  }

  const memberSince = user.criado_em
    ? format(new Date(user.criado_em), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '—'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', animation: 'fadeIn 0.15s ease' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar profile={user} size={48} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {[user.nome, user.sobrenome].filter(Boolean).join(' ') || 'Sem nome'}
                {isSelf && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 8, fontWeight: 600 }}>você</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user.email || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Membro desde {memberSince}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)', padding: '4px 8px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Informações */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Informações</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Nome</label>
              <input style={inp()} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Sobrenome</label>
              <input style={inp()} value={sobrenome} onChange={e => setSobrenome(e.target.value)} placeholder="Sobrenome" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Cargo</label>
              <input style={inp()} value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Vendedor, Gerente..." />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Comissão %</label>
              <input style={inp()} type="number" min={0} max={100} step={0.5} value={comissao} onChange={e => setComissao(e.target.value)} />
            </div>
          </div>

          <Divider />

          {/* Permissões */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Permissões e acesso</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Role */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Papel no sistema</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {role === 'superadmin' ? 'Acesso total — pode ver logs, configurações e gerenciar usuários' : 'Acesso padrão — leads, contratos, desempenho e perfil'}
                </div>
              </div>
              <select
                disabled={isSelf}
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ ...inp({ width: 'auto', marginLeft: 12, cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.5 : 1 }) }}
              >
                <option value="vendedor">Vendedor</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>

            {/* Ativo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 6, border: `1px solid ${!ativo ? 'var(--red)' : 'var(--border)'}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Status da conta</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {ativo ? 'Usuário ativo — pode fazer login normalmente' : 'Usuário inativo — acesso bloqueado'}
                </div>
              </div>
              <button
                disabled={isSelf}
                onClick={() => setAtivo(v => !v)}
                style={{
                  padding: '6px 14px', borderRadius: 5, border: 'none', cursor: isSelf ? 'not-allowed' : 'pointer',
                  background: ativo ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: ativo ? 'var(--green)' : 'var(--red)',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  opacity: isSelf ? 0.5 : 1, marginLeft: 12, flexShrink: 0,
                }}
              >
                {ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          </div>

          <Divider />

          {/* PIX */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Chave PIX</div>
          {user.chave_pix ? (
            <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>{(user.tipo_pix || 'pix').toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{user.chave_pix}</div>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(user.chave_pix)}
                style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              >
                Copiar PIX
              </button>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
              Este usuário ainda não cadastrou uma chave PIX no perfil.
            </div>
          )}

          <Divider />

          {/* Ações de segurança */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Segurança</div>

          <button
            onClick={handleResetSenha}
            disabled={resetting || !user.email}
            style={{
              width: '100%', padding: '9px 14px', borderRadius: 5,
              border: '1px solid var(--border)', background: 'var(--bg3)',
              color: 'var(--text2)', fontSize: 13, cursor: resetting ? 'default' : 'pointer',
              fontFamily: 'inherit', textAlign: 'left', opacity: resetting ? 0.7 : 1,
            }}
          >
            {resetting ? 'Enviando...' : `Enviar e-mail de redefinição de senha para ${user.email || '—'}`}
          </button>

          {/* Feedback */}
          {error && (
            <div style={{ marginTop: 12, padding: '9px 12px', background: 'var(--red-bg)', borderRadius: 5, fontSize: 12, color: 'var(--red)', border: '1px solid var(--red)30' }}>
              {error}
            </div>
          )}
          {ok && (
            <div style={{ marginTop: 12, padding: '9px 12px', background: 'var(--green-bg)', borderRadius: 5, fontSize: 12, color: 'var(--green)', border: '1px solid var(--green)30' }}>
              {ok}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 22px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Aba Sistema ─────────────────────────────────────────────────────────── */

function SistemaTab({ session }) {
  const [nomeEmpresa, setNomeEmpresa] = useState(() => localStorage.getItem('cfg_nome_empresa') || 'José Justo')
  const [followupDias, setFollowupDias] = useState(() => Number(localStorage.getItem('cfg_followup_dias')) || 3)
  const [comissaoPadrao, setComissaoPadrao] = useState(() => Number(localStorage.getItem('cfg_comissao_padrao')) || 10)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('cfg_nome_empresa', nomeEmpresa)
    localStorage.setItem('cfg_followup_dias', followupDias)
    localStorage.setItem('cfg_comissao_padrao', comissaoPadrao)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const lbl = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Identidade</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 400 }}>
          <div>
            <label style={lbl}>Nome da empresa / agência</label>
            <input style={inp()} value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} placeholder="José Justo" />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Regras de negócio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 500 }}>
          <div>
            <label style={lbl}>Dias para alerta de follow-up</label>
            <input style={inp()} type="number" min={1} max={30} value={followupDias} onChange={e => setFollowupDias(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Leads sem atualização após X dias entram no alerta</div>
          </div>
          <div>
            <label style={lbl}>Comissão padrão (%)</label>
            <input style={inp()} type="number" min={0} max={100} step={0.5} value={comissaoPadrao} onChange={e => setComissaoPadrao(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Aplicada automaticamente a novos vendedores</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Projeto Supabase</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Project Ref', value: 'prilivwxekihepvdeass' },
            { label: 'Região', value: 'sa-east-1 (São Paulo)' },
            { label: 'Usuário logado', value: session?.user?.email || '—' },
            { label: 'ID do usuário', value: session?.user?.id || '—' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', width: 140, flexShrink: 0 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleSave}
          style={{ padding: '9px 22px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Salvar configurações
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--green)' }}>Salvo!</span>}
      </div>
    </div>
  )
}

/* ─── Principal ───────────────────────────────────────────────────────────── */

export default function Configuracoes({ session, profile, isSuperAdmin }) {
  const [activeTab,    setActiveTab]    = useState('usuarios')
  const [users,        setUsers]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchQ,      setSearchQ]      = useState('')

  const currentUserId = session?.user?.id

  useEffect(() => {
    if (isSuperAdmin) fetchUsers()
  }, [isSuperAdmin])

  if (!isSuperAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text3)', padding: 40 }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>Acesso restrito</div>
        <div style={{ fontSize: 13 }}>Esta área requer permissão de superadmin.</div>
      </div>
    )
  }

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('nome', { ascending: true })
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  const filtered = users.filter(u => {
    const q = searchQ.toLowerCase()
    return !q || u.nome?.toLowerCase().includes(q) || u.sobrenome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.cargo?.toLowerCase().includes(q)
  })

  const tabStyle = (id) => ({
    padding: '7px 16px', borderRadius: 4, border: 'none',
    background: activeTab === id ? 'var(--bg3)' : 'transparent',
    color: activeTab === id ? 'var(--text)' : 'var(--text3)',
    fontSize: 13, fontWeight: activeTab === id ? 600 : 400,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Configurações</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>Gerencie usuários, permissões e configurações do sistema</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg2)', borderRadius: 5, padding: 3, width: 'fit-content', border: '1px solid var(--border)' }}>
        <button style={tabStyle('usuarios')} onClick={() => setActiveTab('usuarios')}>Usuários</button>
        <button style={tabStyle('sistema')} onClick={() => setActiveTab('sistema')}>Sistema</button>
      </div>

      {/* ── Usuários ── */}
      {activeTab === 'usuarios' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
            <input
              style={{ ...inp({ width: 260 }), padding: '7px 11px' }}
              placeholder="Buscar usuário..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {filtered.length} usuário{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhum usuário encontrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(user => {
                const isSelf = user.id === currentUserId
                const isAdmin = user.role === 'superadmin'
                const isAtivo = user.ativo !== false
                const fullName = [user.nome, user.sobrenome].filter(Boolean).join(' ') || 'Sem nome'
                return (
                  <div
                    key={user.id}
                    className="card"
                    style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                    onClick={() => setSelectedUser(user)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar profile={user} size={42} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: isAtivo ? 'var(--green)' : 'var(--border2)', border: '2px solid var(--bg2)' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fullName}</span>
                        {isSelf && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, background: 'var(--bg3)', padding: '1px 6px', borderRadius: 3 }}>você</span>}
                        <Badge color={isAdmin ? 'var(--purple)' : 'var(--text3)'} bg={isAdmin ? 'var(--purple-bg)' : 'var(--bg3)'}>
                          {isAdmin ? 'superadmin' : 'vendedor'}
                        </Badge>
                        {!isAtivo && <Badge color="var(--red)" bg="var(--red-bg)">Inativo</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                        {user.email}
                        {user.cargo ? ` · ${user.cargo}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                        {user.comissao_percentual ?? 10}%
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>comissão</div>
                    </div>

                    <div style={{ flexShrink: 0, color: 'var(--text3)', fontSize: 18, paddingLeft: 8 }}>›</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Sistema ── */}
      {activeTab === 'sistema' && (
        <SistemaTab session={session} />
      )}

      {/* Modal */}
      {selectedUser && (
        <UserModal
          user={selectedUser}
          currentUserId={currentUserId}
          onClose={() => setSelectedUser(null)}
          onSaved={updated => {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}
