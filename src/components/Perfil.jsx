import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { format } from 'date-fns'
import { IconCamera, IconCheck, IconWhatsApp } from './Icons.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'

export default function Perfil({ profile, session, onUpdateProfile }) {
  const [nome,       setNome]       = useState(profile?.nome        || '')
  const [sobrenome,  setSobrenome]  = useState(profile?.sobrenome   || '')
  const [bio,        setBio]        = useState(profile?.bio         || '')
  const [telefone,   setTelefone]   = useState(profile?.telefone    || '')
  const [cargo,      setCargo]      = useState(profile?.cargo       || '')
  const [whatsapp,   setWhatsapp]   = useState(profile?.whatsapp    || '')
  const [instagram,  setInstagram]  = useState(profile?.instagram   || '')
  const [metaMensal, setMetaMensal] = useState(profile?.meta_mensal ?? 5)
  const [tipoPix,    setTipoPix]    = useState(profile?.tipo_pix    || 'cpf')
  const [chavePix,   setChavePix]   = useState(profile?.chave_pix   || '')
  const [fotoUrl,    setFotoUrl]    = useState(profile?.foto_url    || null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState(null)
  const [hover,      setHover]      = useState(false)
  const [stats,      setStats]      = useState({ fechamentos: 0, valorTotal: 0, contatos: 0 })
  const fileRef  = useRef(null)
  const isMobile = useIsMobile()

  const email        = session?.user?.email || ''
  const userId       = session?.user?.id    || ''
  const isSuperAdmin = profile?.role === 'superadmin'
  const displayUrl   = previewUrl || fotoUrl
  const initials     = [nome, sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  const memberSince  = profile?.criado_em ? format(new Date(profile.criado_em), 'MMM yyyy') : ''
  const conversao    = stats.contatos > 0 ? Math.round((stats.fechamentos / stats.contatos) * 100) : 0

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
    setUploading(true); setError(null)
    try {
      const { error: upErr } = await supabase.storage.from('avatars').upload(`${userId}/avatar`, file, { upsert: true })
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
    const base   = { nome, sobrenome, bio, telefone, foto_url: fotoUrl }
    const extras = { cargo, whatsapp, instagram, meta_mensal: Number(metaMensal) || 5, tipo_pix: tipoPix, chave_pix: chavePix || null }
    const { ok, errorMsg } = await onUpdateProfile({ ...base, ...extras })
    if (!ok && errorMsg?.includes('column')) {
      const { ok: ok2, errorMsg: e2 } = await onUpdateProfile(base)
      setSaving(false)
      if (ok2) { setSaved(true); setError('Perfil salvo. Para salvar cargo/WhatsApp/Instagram rode a migration 008.'); setTimeout(() => setSaved(false), 5000) }
      else setError(`Erro: ${e2 || 'desconhecido'}`)
      return
    }
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else setError(`Erro ao salvar: ${errorMsg || 'verifique as permissões'}`)
  }

  const inp = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg2)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }
  const lbl = { fontSize: 12, color: 'var(--text3)', marginBottom: 5, display: 'block', fontWeight: 500 }

  const statItems = [
    { label: 'Fechamentos',   value: stats.fechamentos, color: '#00CB53' },
    { label: 'Valor gerado',  value: `R$ ${stats.valorTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, color: '#3B82F6' },
    { label: 'Conversão',     value: `${conversao}%`,   color: '#8B5CF6' },
    { label: 'Meta mensal',   value: metaMensal,         color: 'var(--text2)' },
  ]

  return (
    <div style={{ padding: isMobile ? '16px' : '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Coluna esquerda: cartão de perfil ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Avatar + nome */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow)' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '3px solid var(--border)' }}
              >
                {displayUrl
                  ? <img src={displayUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: '#00CB53', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff' }}>{initials}</div>
                }
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', opacity: hover && !uploading ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
                  <IconCamera size={22} color="#fff" />
                </div>
              </div>
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: '#fff' }}>...</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
            </div>

            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.2 }}>
              {[nome, sobrenome].filter(Boolean).join(' ') || 'Sem nome'}
            </div>

            <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isSuperAdmin ? '#00CB53' : 'var(--bg3)', color: isSuperAdmin ? '#fff' : 'var(--text3)', border: isSuperAdmin ? 'none' : '1px solid var(--border)', marginBottom: cargo ? 6 : 0 }}>
              {isSuperAdmin ? 'Admin' : 'Vendedor'}
            </span>

            {cargo && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{cargo}</div>}

            {bio && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 12, lineHeight: 1.6, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 12, width: '100%' }}>
                "{bio}"
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
              {email}
              {memberSince && <><br />Membro desde {memberSince}</>}
            </div>
          </div>

          {/* Stats */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            {statItems.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < statItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Chave PIX */}
          {chavePix && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Chave PIX</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{tipoPix.toUpperCase()}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginBottom: 8 }}>{chavePix}</div>
              <button type="button" onClick={() => navigator.clipboard.writeText(chavePix)}
                style={{ fontSize: 12, color: '#00CB53', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                Copiar chave
              </button>
            </div>
          )}
        </div>

        {/* ── Coluna direita: formulário ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Seção: Dados pessoais */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Dados pessoais</div>
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
                <input style={{ ...inp, color: 'var(--text3)', cursor: 'not-allowed', background: 'var(--bg3)' }} value={email} readOnly />
              </div>
              <div>
                <label style={lbl}>Telefone</label>
                <input style={inp} value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(15) 99999-9999" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Bio <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({bio.length}/160)</span></label>
                <textarea style={{ ...inp, resize: 'vertical', minHeight: 72, lineHeight: 1.6 }} value={bio} onChange={e => setBio(e.target.value.slice(0, 160))} placeholder="Uma apresentação curta..." />
              </div>
            </div>
          </div>

          {/* Seção: Perfil profissional */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Perfil profissional</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
              <div>
                <label style={lbl}>Cargo / Título</label>
                <input style={inp} value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Vendedor, Gerente Comercial..." />
              </div>
              <div>
                <label style={lbl}>Meta mensal (fechamentos)</label>
                <input style={inp} type="number" min={1} value={metaMensal} onChange={e => setMetaMensal(e.target.value)} placeholder="5" />
              </div>
            </div>
          </div>

          {/* Seção: Contato rápido */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Contato rápido</div>
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
                  <input style={{ ...inp, paddingLeft: 26 }} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario" />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)', lineHeight: 1 }}>@</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Chave PIX */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>Chave PIX</div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px 14px' }}>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={tipoPix} onChange={e => setTipoPix(e.target.value)}>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Aleatória</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Chave</label>
                <input style={inp} value={chavePix} onChange={e => setChavePix(e.target.value)}
                  placeholder={
                    tipoPix === 'cpf' ? '000.000.000-00' :
                    tipoPix === 'cnpj' ? '00.000.000/0001-00' :
                    tipoPix === 'email' ? 'email@exemplo.com' :
                    tipoPix === 'telefone' ? '+5515999999999' : 'UUID'
                  }
                />
              </div>
            </div>
          </div>

          {/* Feedback + botão */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid #BE123C30', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
              {error}
            </div>
          )}
          {saved && (
            <div style={{ padding: '10px 14px', background: 'var(--green-bg)', border: '1px solid var(--green)30', borderRadius: 8, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCheck size={13} color="var(--green)" /> Perfil salvo com sucesso!
            </div>
          )}

          <div>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#00CB53', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving || uploading ? 'default' : 'pointer', opacity: saving || uploading ? 0.7 : 1, fontFamily: 'inherit' }}
            >
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
