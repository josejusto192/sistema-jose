import React, { useState, useRef } from 'react'
import { supabase } from '../supabase.js'
import { IconCamera } from './Icons.jsx'

export default function Perfil({ profile, session, onUpdateProfile }) {
  const [nome, setNome] = useState(profile?.nome || '')
  const [sobrenome, setSobrenome] = useState(profile?.sobrenome || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [telefone, setTelefone] = useState(profile?.telefone || '')
  const [fotoUrl, setFotoUrl] = useState(profile?.foto_url || null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [avatarHover, setAvatarHover] = useState(false)
  const fileInputRef = useRef(null)

  const email = session?.user?.email || ''
  const userId = session?.user?.id || ''

  const displayUrl = previewUrl || fotoUrl
  const initials = [nome, sobrenome]
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    setError(null)
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${userId}/avatar`, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar`)
      const url = data.publicUrl + '?t=' + Date.now()
      setFotoUrl(url)
    } catch (err) {
      setError('Erro ao fazer upload da foto.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const updates = { nome, sobrenome, bio, telefone, foto_url: fotoUrl }
    const ok = await onUpdateProfile(updates)
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError('Erro ao salvar. Tente novamente.')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: 12,
    color: 'var(--text3)',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 540, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24, marginTop: 0 }}>
        Meu Perfil
      </h2>

      <div className="card" style={{ padding: 32 }}>

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                overflow: 'hidden',
                cursor: uploading ? 'default' : 'pointer',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt="avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  {initials}
                </div>
              )}
              {/* Hover overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                opacity: avatarHover && !uploading ? 1 : 0,
                transition: 'opacity 0.15s',
                pointerEvents: 'none',
              }}>
                <IconCamera size={22} color="#fff" />
              </div>
            </div>
            {uploading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10, color: '#fff' }}>...</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Form fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px' }}>
          {/* Nome + Sobrenome */}
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="João"
            />
          </div>
          <div>
            <label style={labelStyle}>Sobrenome</label>
            <input
              style={inputStyle}
              value={sobrenome}
              onChange={e => setSobrenome(e.target.value)}
              placeholder="Silva"
            />
          </div>

          {/* Telefone + Email */}
          <div>
            <label style={labelStyle}>Telefone</label>
            <input
              style={inputStyle}
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              style={{ ...inputStyle, color: 'var(--text3)', background: 'var(--bg2)', cursor: 'not-allowed' }}
              value={email}
              readOnly
            />
          </div>

          {/* Bio - full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              Bio
              <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({bio.length}/160)</span>
            </label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 160))}
              placeholder="Fale um pouco sobre você..."
              maxLength={160}
            />
          </div>
        </div>

        {/* Error / success */}
        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--red-bg, #FFF1F2)', border: '1px solid var(--red, #BE123C)40', borderRadius: 7, fontSize: 12, color: 'var(--red, #BE123C)' }}>
            {error}
          </div>
        )}
        {saved && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--green-bg)', border: '1px solid var(--green)40', borderRadius: 7, fontSize: 12, color: 'var(--green)' }}>
            Perfil salvo com sucesso!
          </div>
        )}

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            style={{
              padding: '9px 22px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving || uploading ? 'default' : 'pointer',
              opacity: saving || uploading ? 0.7 : 1,
              fontFamily: 'inherit',
              transition: 'opacity 0.12s',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
