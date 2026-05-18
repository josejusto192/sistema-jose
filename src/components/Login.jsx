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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <svg width="32" height="32" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="56" height="56" rx="12" fill="#00CB53" fillOpacity="0.12"/>
              <path d="M28 10C21.373 10 16 15.373 16 22v2.5C13.791 25.674 12 27.8 12 30.5v2a3 3 0 0 0 2 2.83V36a8 8 0 0 0 8 8h.17A4.002 4.002 0 0 0 28 46a4.002 4.002 0 0 0 7.83-2H36a8 8 0 0 0 8-8v-.17A3 3 0 0 0 46 32.5v-2c0-2.7-1.791-4.826-4-5.998V22C42 15.373 36.627 10 28 10z" fill="#00CB53" opacity="0.2"/>
              <path d="M28 12C22.477 12 18 16.477 18 22v2.815A6.5 6.5 0 0 0 13.5 31v1.5a3 3 0 0 0 2 2.83V36a8 8 0 0 0 8 8h.17A4.002 4.002 0 0 0 36 44h.33a8 8 0 0 0 8-8v-1.67A3 3 0 0 0 46.5 32.5V31A6.5 6.5 0 0 0 38 24.815V22C38 16.477 33.523 12 28 12z" stroke="#00CB53" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M23 13.5C23 13.5 24.8 12 28 12s5 1.5 5 1.5" stroke="#00CB53" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
              <circle cx="41" cy="15" r="3" fill="#00CB53"/>
              <circle cx="44" cy="10" r="2" fill="#00CB53" opacity="0.5"/>
            </svg>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.5px', color: 'var(--text)', fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
              Tilim
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            O Som da Venda
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
