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
    <main className="login-page">
      <section className="login-showcase" aria-label="Justo Mídias CRM">
        <div className="login-brand">
          <img src="/logo horizontal.svg" alt="Justo Mídias" />
        </div>

        <div className="login-story">
          <span className="login-eyebrow">Inteligência comercial</span>
          <h1>Trabalho comercial, com ritmo e clareza.</h1>
          <p>
            Leads, conversas e contratos no mesmo fluxo — para sua equipe vender melhor
            sem perder tempo procurando informação.
          </p>
          <div className="login-pill-row" aria-label="Recursos do sistema">
            <span className="login-pill">Pipeline em tempo real</span>
            <span className="login-pill">Automação inteligente</span>
            <span className="login-pill">Gestão de equipe</span>
          </div>
        </div>

        <div className="login-proof">
          <span className="login-proof-mark" aria-hidden="true">↗</span>
          <span>Um workspace construído para transformar movimento em resultado.</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-logo">
            <img src="/icone.svg" alt="Justo Mídias" />
          </div>
          <div className="login-kicker">Bem-vindo de volta</div>
          <h2>Entre no seu workspace</h2>
          <p className="login-subtitle">Use seu e-mail corporativo para continuar.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-field">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="login-submit">
              <span>{loading ? 'Entrando...' : 'Entrar no sistema'}</span>
              <span className="login-submit-arrow" aria-hidden="true">→</span>
            </button>
          </form>
          <p className="login-footnote">Conexão segura e dados protegidos</p>
        </div>
      </section>
    </main>
  )
}
