import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

function AvatarCircle({ profile, size = 36 }) {
  const initials = [profile?.nome, profile?.sobrenome]
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'
  if (profile?.foto_url) {
    return (
      <img
        src={profile.foto_url}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.36,
      fontWeight: 600,
      color: '#fff',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function Configuracoes({ session, profile }) {
  const [activeTab, setActiveTab] = useState('usuarios')
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [updating, setUpdating] = useState(null)

  const currentUserId = session?.user?.id

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoadingUsers(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('nome', { ascending: true })
    if (!error) setUsers(data || [])
    setLoadingUsers(false)
  }

  async function toggleRole(user) {
    if (user.id === currentUserId) return
    const newRole = user.role === 'superadmin' ? 'vendedor' : 'superadmin'
    setUpdating(user.id + '_role')
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id)
    if (!error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    }
    setUpdating(null)
  }

  async function toggleAtivo(user) {
    if (user.id === currentUserId) return
    const newAtivo = !user.ativo
    setUpdating(user.id + '_ativo')
    const { error } = await supabase
      .from('profiles')
      .update({ ativo: newAtivo })
      .eq('id', user.id)
    if (!error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ativo: newAtivo } : u))
    }
    setUpdating(null)
  }

  async function updateComissao(userId, newValue) {
    const val = parseFloat(newValue)
    if (isNaN(val)) return
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, comissao_percentual: val } : u))
    await supabase.from('profiles').update({ comissao_percentual: val }).eq('id', userId)
  }

  const tabStyle = (id) => ({
    padding: '8px 18px',
    borderRadius: 7,
    border: 'none',
    background: activeTab === id ? 'var(--bg3)' : 'transparent',
    color: activeTab === id ? 'var(--text)' : 'var(--text3)',
    fontSize: 13,
    fontWeight: activeTab === id ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.12s',
  })

  const btnStyle = (disabled) => ({
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: disabled ? 'var(--text3)' : 'var(--text2)',
    fontSize: 11,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
    transition: 'all 0.12s',
  })

  return (
    <div style={{ padding: '32px 24px', maxWidth: 780, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20, marginTop: 0 }}>
        Configurações
      </h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)', borderRadius: 9, padding: 4, alignSelf: 'flex-start', width: 'fit-content', border: '1px solid var(--border)' }}>
        <button style={tabStyle('usuarios')} onClick={() => setActiveTab('usuarios')}>Usuários</button>
        <button style={tabStyle('sistema')} onClick={() => setActiveTab('sistema')}>Sistema</button>
      </div>

      {activeTab === 'usuarios' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loadingUsers ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Nenhum usuário encontrado.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Usuário', 'E-mail', 'Papel', 'Status', 'Comissão %', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => {
                  const isSelf = user.id === currentUserId
                  const isUpdatingRole = updating === user.id + '_role'
                  const isUpdatingAtivo = updating === user.id + '_ativo'
                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isSelf ? 'var(--bg2)' : 'transparent',
                      }}
                    >
                      {/* Usuário */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AvatarCircle profile={user} size={34} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                              {[user.nome, user.sobrenome].filter(Boolean).join(' ') || '—'}
                              {isSelf && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6, fontWeight: 600 }}>você</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* E-mail */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{user.email || '—'}</span>
                      </td>

                      {/* Papel */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 9px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: user.role === 'superadmin' ? 'var(--purple-bg)' : 'var(--bg3)',
                          color: user.role === 'superadmin' ? 'var(--purple)' : 'var(--text3)',
                        }}>
                          {user.role === 'superadmin' ? 'superadmin' : 'vendedor'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 9px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: user.ativo !== false ? 'var(--green-bg)' : 'var(--red-bg, #FFF1F2)',
                          color: user.ativo !== false ? 'var(--green)' : 'var(--red, #BE123C)',
                        }}>
                          {user.ativo !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Comissão % */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={user.comissao_percentual ?? 10}
                            onChange={e => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, comissao_percentual: e.target.value } : u))}
                            onBlur={e => updateComissao(user.id, e.target.value)}
                            style={{
                              width: 60,
                              padding: '4px 8px',
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              color: 'var(--text)',
                              fontSize: 12,
                              outline: 'none',
                              fontFamily: 'inherit',
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>%</span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            disabled={isSelf || isUpdatingRole}
                            onClick={() => toggleRole(user)}
                            style={btnStyle(isSelf || isUpdatingRole)}
                          >
                            {isUpdatingRole ? '...' : user.role === 'superadmin' ? '↓ vendedor' : '↑ admin'}
                          </button>
                          <button
                            disabled={isSelf || isUpdatingAtivo}
                            onClick={() => toggleAtivo(user)}
                            style={btnStyle(isSelf || isUpdatingAtivo)}
                          >
                            {isUpdatingAtivo ? '...' : user.ativo !== false ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'sistema' && (
        <div className="card" style={{ padding: 32 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)' }}>
            Mais configurações em breve.
          </p>
        </div>
      )}
    </div>
  )
}
