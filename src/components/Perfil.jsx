import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { format } from 'date-fns'
import { IconCamera, IconCheck, IconWhatsApp, IconMail, IconPhone } from './Icons.jsx'

function StatCard({ label, value, color = 'var(--accent)', sub }) {
  return (
    <div className="card" style={{ padding: '16px 20px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

export default function Perfil({ profile, session, onUpdateProfile }) {
  const [nome,        setNome]        = useState(profile?.nome        || '')
  const [sobrenome,   setSobrenome]   = useState(profile?.sobrenome   || '')
  const [bio,         setBio]         = useState(profile?.bio         || '')
  const [telefone,    setTelefone]    = useState(profile?.telefone    || '')
  const [cargo,       setCargo]       = useState(profile?.cargo       || '')
  const [whatsapp,    setWhatsapp]    = useState(profile?.whatsapp    || '')
  const [instagram,   setInstagram]   = useState(profile?.instagram   || '')
  const [metaMensal,  setMetaMensal]  = useState(profile?.meta_mensal ?? 5)
  const [tipoPix,     setTipoPix]     = useState(profile?.tipo_pix    || 'cpf')
  const [chavePix,    setChavePix]    = useState(profile?.chave_pix   || '')
  const [fotoUrl,     setFotoUrl]     = useState(profile?.foto_url    || null)
  const [previewUrl,  setPreviewUrl]  = useState(null)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState(null)
  const [hover,       setHover]       = useState(false)
  const [stats,       setStats]       = useState({ fechamentos: 0, valorTotal: 0, contatos: 0 })
  const fileRef = useRef(null)

  const email  = session?.user?.email || ''
  const userId = session?.user?.id    || ''
  const isSuperAdmin = profile?.role === 'superadmin'
  const displayUrl = previewUrl || fotoUrl
  const initials = [nome, sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  const memberSince = profile?.criado_em ? format(new Date(profile.criado_em), 'MMM yyyy') : ''

  useEffect(() => {
    async function loadStats() {
      const [{ data: hist }, { data: ctrs }] = await Promise.all([
        supabase.from('status_history').select('status_novo').eq('usuario_id', userId),
        supabase.from('contratos').select('valor_total, valor_mensal').eq('vendedor_id', userId),
      ])
      const fechamentos = (hist || []).filter(h => h.status_novo === 'fechou').length
      const contatos    = (hist || []).filter(h => h.status_novo === 'contatado').length
      const valorTotal  = (ctrs || []).reduce((s, c) => s + (Number(c.valor_total || c.valor_mensal) || 0), 0)
      setStats({ fechamentos, valorTotal, contatos })
    }
    if (userId) loadStats()
  }, [userId])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    setError(null)
    try {
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(`${userId}/avatar`, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar`)
      setFotoUrl(data.publicUrl + '?t=' + Date.now())
    } catch {
      setError('Erro ao fazer upload da foto.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)

    // Campos base (sempre existem desde migration 004 + 006)
    const base = { nome, sobrenome, bio, telefone, foto_url: fotoUrl }

    // Campos novos (migration 008 — podem não existir ainda)
    const extras = { cargo, whatsapp, instagram, meta_mensal: Number(metaMensal) || 5, tipo_pix: tipoPix, chave_pix: chavePix || null }

    const { ok, errorMsg } = await onUpdateProfile({ ...base, ...extras })
    if (!ok && errorMsg?.includes('column')) {
      // Colunas novas ainda não existem — salva só os campos base
      const { ok: ok2, errorMsg: e2 } = await onUpdateProfile(base)
      setSaving(false)
      if (ok2) {
        setSaved(true)
        setError('Perfil salvo. Para salvar cargo/WhatsApp/Instagram rode a migration 008 no Supabase.')
        setTimeout(() => setSaved(false), 5000)
      } else {
        setError(`Erro: ${e2 || 'desconhecido'}`)
      }
      return
    }

    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else setError(`Erro ao salvar: ${errorMsg || 'verifique as permissões (policy own_profile_update)'}`)
  }

  const inp = {
    width: '100%', padding: '8px 11px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg3)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const lbl = { fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'block' }
  const conversao = stats.contatos > 0
    ? Math.round((stats.fechamentos / stats.contatos) * 100)
    : 0

  return (
    <div style={{ padding: '24px 32px', maxWidth: 680, margin: '0 auto' }}>

      {/* Header card — avatar + identidade */}
      <div className="card" style={{ padding: '28px 32px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 28 }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
          >
            {displayUrl
              ? <img src={displayUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#fff' }}>{initials}</div>
            }
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', opacity: hover && !uploading ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
              <IconCamera size={24} color="#fff" />
            </div>
          </div>
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff' }}>...</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {/* Identidade */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {[nome, sobrenome].filter(Boolean).join(' ') || 'Sem nome'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isSuperAdmin ? 'var(--accent)' : 'var(--bg3)', color: isSuperAdmin ? '#fff' : 'var(--text3)', border: isSuperAdmin ? 'none' : '1px solid var(--border)' }}>
              {isSuperAdmin ? 'superadmin' : 'vendedor'}
            </span>
            {cargo && (
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{cargo}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {email}{memberSince && ` · Membro desde ${memberSince}`}
          </div>
          {bio && (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
              "{bio}"
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <StatCard label="Fechamentos" value={stats.fechamentos} color="var(--green)" />
        <StatCard label="Valor gerado" value={`R$ ${stats.valorTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} color="var(--accent)" />
        <StatCard label="Conversão" value={`${conversao}%`} color="var(--purple)" sub={`${stats.contatos} contatos`} />
        <StatCard label="Meta mensal" value={metaMensal} color="var(--text2)" sub="fechamentos/mês" />
      </div>

      {/* Formulário */}
      <div className="card" style={{ padding: '24px 28px' }}>

        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Informações pessoais</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
            <div>
              <label style={lbl}>Nome</label>
              <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="José" />
            </div>
            <div>
              <label style={lbl}>Sobrenome</label>
              <input style={inp} value={sobrenome} onChange={e => setSobrenome(e.target.value)} placeholder="Justo" />
            </div>
            <div>
              <label style={lbl}>E-mail</label>
              <input style={{ ...inp, color: 'var(--text3)', cursor: 'not-allowed' }} value={email} readOnly />
            </div>
            <div>
              <label style={lbl}>Telefone</label>
              <input style={inp} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(15) 99999-9999" />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Contato rápido</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
            <div>
              <label style={lbl}>WhatsApp</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingLeft: 32 }} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5515999999999" />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><IconWhatsApp size={13} color="var(--text3)" /></span>
              </div>
            </div>
            <div>
              <label style={lbl}>Instagram</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingLeft: 28 }} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario" />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)' }}>@</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Chave PIX</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '12px 14px' }}>
            <div>
              <label style={lbl}>Tipo de chave</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={tipoPix} onChange={e => setTipoPix(e.target.value)}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave aleatória</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Chave PIX</label>
              <input style={inp} value={chavePix} onChange={e => setChavePix(e.target.value)}
                placeholder={
                  tipoPix === 'cpf' ? '000.000.000-00' :
                  tipoPix === 'cnpj' ? '00.000.000/0001-00' :
                  tipoPix === 'email' ? 'email@exemplo.com' :
                  tipoPix === 'telefone' ? '+5515999999999' :
                  'Chave aleatória UUID'
                }
              />
            </div>
          </div>
          {chavePix && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 5, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {tipoPix.toUpperCase()}: <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{chavePix}</strong>
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(chavePix)}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                Copiar
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Perfil profissional</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
            <div>
              <label style={lbl}>Cargo / Título</label>
              <input style={inp} value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Vendedor, Gerente Comercial..." />
            </div>
            <div>
              <label style={lbl}>Meta mensal (fechamentos)</label>
              <input style={inp} type="number" min={1} value={metaMensal} onChange={e => setMetaMensal(e.target.value)} placeholder="5" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ ...lbl }}>
                Bio <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({bio.length}/160)</span>
              </label>
              <textarea
                style={{ ...inp, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }}
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 160))}
                placeholder="Apresentação curta exibida no seu perfil..."
              />
            </div>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div style={{ marginBottom: 14, padding: '9px 13px', background: 'var(--red-bg, #FFF1F2)', border: '1px solid #BE123C30', borderRadius: 8, fontSize: 12, color: 'var(--red, #BE123C)' }}>
            {error}
          </div>
        )}
        {saved && (
          <div style={{ marginBottom: 14, padding: '9px 13px', background: 'var(--green-bg)', border: '1px solid var(--green)30', borderRadius: 8, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={13} color="var(--green)" /> Perfil salvo com sucesso!
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving || uploading ? 'default' : 'pointer', opacity: saving || uploading ? 0.7 : 1, fontFamily: 'inherit' }}
          >
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </div>
    </div>
  )
}
