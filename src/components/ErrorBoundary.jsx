import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#F7F8FA', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          maxWidth: 480, width: '100%', margin: '0 20px',
          background: '#fff', border: '1px solid #E4E7EC',
          borderRadius: 12, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#101828', marginBottom: 8 }}>
            Algo deu errado
          </h2>
          <p style={{ fontSize: 13, color: '#667085', lineHeight: 1.6, marginBottom: 20 }}>
            O sistema encontrou um erro inesperado. Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
          </p>
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20,
            fontFamily: 'monospace', fontSize: 12, color: '#991B1B',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflow: 'auto',
          }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Recarregar página
          </button>
        </div>
      </div>
    )
  }
}
