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

function UserModal({ user, currentUserId, onClose, onSaved, logAction }) {
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
    const updated = { ...user, nome, sobrenome, cargo, comissao_percentual: Number(comissao), role, ativo }
    onSaved(updated)
    logAction?.('atualizar', 'users', user.id, { nome, sobrenome, cargo, role, ativo, comissao_percentual: Number(comissao) })
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
  const [comissaoPadrao, setComissaoPadrao] = useState(() => Number(localStorage.getItem('cfg_comissao_padrao')) || 10)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('cfg_nome_empresa', nomeEmpresa)
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

/* ─── Aba Serviços (Pacotes) ──────────────────────────────────────────────── */

const EMPTY_FORM = { codigo: '', nome: '', descricao: '', tipo: 'pontual', valor: '', cor: '#3B82F6', ativo: true }

function toSlug(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function PacotesTab({ logAction }) {
  const [pacotes,    setPacotes]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)   // null | 'new' | objeto
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error,      setError]      = useState(null)

  const isNew = modal === 'new'

  useEffect(() => { fetchPacotes() }, [])

  async function fetchPacotes() {
    setLoading(true)
    const { data, error: err } = await supabase.from('pacotes').select('*').order('criado_em')
    if (!err) setPacotes(data || [])
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setError(null)
    setConfirmDel(false)
    setModal('new')
  }

  function openEdit(pacote) {
    setForm({
      codigo:    pacote.codigo    || '',
      nome:      pacote.nome      || '',
      descricao: pacote.descricao || '',
      tipo:      pacote.tipo      || 'pontual',
      valor:     pacote.valor     ?? '',
      cor:       pacote.cor       || '#3B82F6',
      ativo:     pacote.ativo !== false,
    })
    setError(null)
    setConfirmDel(false)
    setModal(pacote)
  }

  function closeModal() {
    setModal(null)
    setConfirmDel(false)
    setError(null)
  }

  function handleNomeChange(e) {
    const nome = e.target.value
    setForm(f => ({ ...f, nome, ...(isNew ? { codigo: toSlug(nome) } : {}) }))
  }

  function validate() {
    if (!form.nome.trim())   return 'Nome é obrigatório.'
    if (!form.codigo.trim()) return 'Código é obrigatório.'
    if (!form.valor || Number(form.valor) <= 0) return 'Valor deve ser maior que 0.'
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError(null)
    const payload = {
      codigo:    form.codigo.trim(),
      nome:      form.nome.trim(),
      descricao: form.descricao.trim(),
      tipo:      form.tipo,
      valor:     Number(form.valor),
      cor:       form.cor,
      ativo:     form.ativo,
    }
    let dbErr
    if (isNew) {
      const { error: e } = await supabase.from('pacotes').insert(payload)
      dbErr = e
    } else {
      const { error: e } = await supabase.from('pacotes').upsert({ id: modal.id, ...payload }, { onConflict: 'id' })
      dbErr = e
    }
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    logAction?.(isNew ? 'criar' : 'atualizar', 'pacotes', isNew ? payload.codigo : modal.id, { nome: payload.nome, tipo: payload.tipo, valor: payload.valor })
    await fetchPacotes()
    closeModal()
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return }
    setSaving(true)
    const { error: dbErr } = await supabase.from('pacotes').delete().eq('id', modal.id)
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    logAction?.('deletar', 'pacotes', modal.id, { nome: modal.nome })
    await fetchPacotes()
    closeModal()
  }

  const lbl = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {pacotes.length} serviço{pacotes.length !== 1 ? 's' : ''} cadastrado{pacotes.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={openNew}
          style={{ padding: '8px 16px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Novo serviço
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      ) : pacotes.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhum serviço cadastrado ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pacotes.map(p => (
            <div
              key={p.id}
              className="card"
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', opacity: p.ativo !== false ? 1 : 0.5, transition: 'box-shadow 0.12s' }}
              onClick={() => openEdit(p)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
            >
              {/* Cor dot */}
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.cor || '#3B82F6', flexShrink: 0, border: '1.5px solid var(--border)' }} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.nome}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 600,
                    background: p.tipo === 'recorrente' ? 'var(--green-bg)' : 'var(--bg3)',
                    color: p.tipo === 'recorrente' ? 'var(--green)' : 'var(--accent)',
                  }}>
                    {p.tipo === 'recorrente' ? 'Recorrente' : 'Pontual'}
                  </span>
                  {p.ativo === false && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 600, background: 'var(--red-bg)', color: 'var(--red)' }}>
                      Inativo
                    </span>
                  )}
                </div>
                {p.descricao && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{p.codigo}</div>
              </div>

              {/* Valor */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>

              <div style={{ flexShrink: 0, color: 'var(--text3)', fontSize: 18, paddingLeft: 4 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', animation: 'fadeIn 0.15s ease' }}
          >
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {isNew ? 'Novo serviço' : 'Editar serviço'}
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)', padding: '4px 8px' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Nome */}
              <div>
                <label style={lbl}>Nome <span style={{ color: 'var(--red)' }}>*</span></label>
                <input style={inp()} value={form.nome} onChange={handleNomeChange} placeholder="Ex: Gestão de Tráfego" />
              </div>

              {/* Código */}
              <div>
                <label style={lbl}>Código (slug) <span style={{ color: 'var(--red)' }}>*</span></label>
                <input
                  style={inp({ fontFamily: 'var(--font-mono)', opacity: isNew ? 1 : 0.6, cursor: isNew ? 'text' : 'not-allowed' })}
                  value={form.codigo}
                  onChange={e => isNew && setForm(f => ({ ...f, codigo: toSlug(e.target.value) }))}
                  readOnly={!isNew}
                  placeholder="gestao_de_trafego"
                />
                {!isNew && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>O código não pode ser alterado após a criação.</div>}
              </div>

              {/* Descrição */}
              <div>
                <label style={lbl}>Descrição</label>
                <textarea
                  style={{ ...inp(), resize: 'vertical', minHeight: 64 }}
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva o serviço..."
                />
              </div>

              {/* Tipo + Valor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Tipo</label>
                  <select style={inp({ cursor: 'pointer' })} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="pontual">Pontual</option>
                    <option value="recorrente">Recorrente</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Valor (R$) <span style={{ color: 'var(--red)' }}>*</span></label>
                  <input style={inp()} type="number" min={0} step={0.01} value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                </div>
              </div>

              {/* Cor + Ativo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <label style={lbl}>Cor</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={form.cor}
                      onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                      style={{ width: 36, height: 32, borderRadius: 5, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'var(--bg3)' }}
                    />
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>{form.cor}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                    style={{
                      padding: '6px 14px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: form.ativo ? 'var(--green-bg)' : 'var(--red-bg)',
                      color: form.ativo ? 'var(--green)' : 'var(--red)',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    {form.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Status do serviço</span>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div style={{ padding: '9px 12px', background: 'var(--red-bg)', borderRadius: 5, fontSize: 12, color: 'var(--red)', border: '1px solid var(--red)30' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              {/* Excluir (só em edição) */}
              <div>
                {!isNew && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    style={{
                      padding: '8px 16px', borderRadius: 5, border: '1px solid var(--red)40', cursor: saving ? 'default' : 'pointer',
                      background: confirmDel ? 'var(--red)' : 'var(--red-bg)',
                      color: confirmDel ? '#fff' : 'var(--red)',
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {confirmDel ? 'Confirmar exclusão' : 'Excluir'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={closeModal}
                  style={{ padding: '8px 18px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: '8px 22px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Salvando...' : isNew ? 'Criar serviço' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Aba Scripts ─────────────────────────────────────────────────────────── */

function ScriptsTab({ logAction }) {
  const [scripts, setScripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { script? }
  const [form, setForm] = useState({ titulo: '', canal: 'whatsapp', texto: '', ordem: 0 })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchScripts() }, [])

  async function fetchScripts() {
    setLoading(true)
    const { data, error } = await supabase.from('scripts').select('*').eq('ativo', true).order('ordem')
    if (!error && data) {
      if (data.length === 0) {
        await seedScripts()
        return
      }
      setScripts(data)
    }
    setLoading(false)
  }

  async function seedScripts() {
    const { data } = await supabase.from('scripts').select('*').eq('ativo', true).order('ordem')
    setScripts(data || [])
    setLoading(false)
  }

  function openCreate() {
    setForm({ titulo: '', canal: 'whatsapp', texto: '', ordem: scripts.length * 10 })
    setModal({ script: null })
  }

  function openEdit(s) {
    setForm({ titulo: s.titulo, canal: s.canal, texto: s.texto, ordem: s.ordem })
    setModal({ script: s })
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.texto.trim()) return
    setSaving(true)
    if (modal.script) {
      const { error } = await supabase.from('scripts').update({ titulo: form.titulo, canal: form.canal, texto: form.texto, ordem: form.ordem }).eq('id', modal.script.id)
      if (!error) { logAction('atualizar', 'scripts', modal.script.id, { titulo: form.titulo }); await fetchScripts() }
    } else {
      const { error } = await supabase.from('scripts').insert({ titulo: form.titulo, canal: form.canal, texto: form.texto, ordem: form.ordem })
      if (!error) { logAction('criar', 'scripts', null, { titulo: form.titulo }); await fetchScripts() }
    }
    setSaving(false)
    setModal(null)
  }

  async function handleDelete(id) {
    setDeleting(id)
    const { error } = await supabase.from('scripts').update({ ativo: false }).eq('id', id)
    if (!error) { logAction('deletar', 'scripts', id, {}); setScripts(prev => prev.filter(s => s.id !== id)) }
    setDeleting(null)
  }

  const CANAIS = ['whatsapp', 'instagram', 'email', 'ligacao']
  const canalLabel = { whatsapp: '💬 WhatsApp', instagram: '📸 Instagram', email: '📧 E-mail', ligacao: '📞 Ligação' }

  const inputStyle = { width: '100%', padding: '8px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Scripts de abordagem exibidos na tela do lead</div>
        <button onClick={openCreate} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Novo script
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      ) : scripts.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhum script cadastrado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scripts.map(s => (
            <div key={s.id} className="card" style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' }}>{canalLabel[s.canal] || s.canal}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{s.titulo}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.texto.slice(0, 120)}{s.texto.length > 120 ? '...' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(s)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>Editar</button>
                <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #FECACA', background: 'transparent', color: '#EF4444', fontSize: 12, cursor: 'pointer', opacity: deleting === s.id ? 0.5 : 1 }}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, width: '100%', maxWidth: 560 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 18 }}>{modal.script ? 'Editar script' : 'Novo script'}</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>TÍTULO</div>
              <input value={form.titulo} onChange={e => setForm(p => ({...p, titulo: e.target.value}))} placeholder="Ex: WhatsApp — Prospecção inicial" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>CANAL</div>
              <select value={form.canal} onChange={e => setForm(p => ({...p, canal: e.target.value}))} style={inputStyle}>
                {CANAIS.map(c => <option key={c} value={c}>{canalLabel[c]}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>TEXTO <span style={{ fontWeight: 400 }}>(use [Nome] e [Empresa] como variáveis)</span></div>
              <textarea value={form.texto} onChange={e => setForm(p => ({...p, texto: e.target.value}))} rows={8} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Principal ───────────────────────────────────────────────────────────── */

export default function Configuracoes({ session, profile, isSuperAdmin, logAction }) {
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
    <div style={{ padding: '28px 32px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Configurações</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>Gerencie usuários, permissões e configurações do sistema</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg2)', borderRadius: 5, padding: 3, width: 'fit-content', border: '1px solid var(--border)' }}>
        <button style={tabStyle('usuarios')} onClick={() => setActiveTab('usuarios')}>Usuários</button>
        <button style={tabStyle('sistema')} onClick={() => setActiveTab('sistema')}>Sistema</button>
        <button style={tabStyle('servicos')} onClick={() => setActiveTab('servicos')}>Serviços</button>
        <button style={tabStyle('scripts')} onClick={() => setActiveTab('scripts')}>Scripts</button>
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

      {/* ── Serviços ── */}
      {activeTab === 'servicos' && <PacotesTab logAction={logAction} />}

      {/* ── Scripts ── */}
      {activeTab === 'scripts' && <ScriptsTab logAction={logAction} />}

      {/* Modal */}
      {selectedUser && (
        <UserModal
          user={selectedUser}
          currentUserId={currentUserId}
          logAction={logAction}
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
