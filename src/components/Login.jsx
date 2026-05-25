import React, { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '36px 32px',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', color: 'var(--text)', fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
              Justo <span style={{ fontWeight: 400, color: 'var(--text3)' }}>CRM</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Acesse sua conta</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '9px 12px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#B91C1C', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px',
              background: loading ? 'var(--bg3)' : 'var(--accent)',
              border: 'none', borderRadius: 8,
              color: loading ? 'var(--text3)' : '#fff',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', marginTop: 2,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
