import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

const DialogContext = createContext(null)

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog deve ser usado dentro de <DialogProvider>')
  return ctx
}

const TOAST_COLORS = {
  info:    { bg: 'var(--bg2)', border: 'var(--border)', icon: 'ℹ️' },
  success: { bg: 'var(--bg2)', border: '#22c55e', icon: '✅' },
  error:   { bg: 'var(--bg2)', border: '#ef4444', icon: '⚠️' },
}

function ConfirmModal({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
      >
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{title || 'Confirmar ação'}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {cancelLabel || 'Cancelar'}
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: danger ? '#ef4444' : 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      {toasts.map(t => {
        const colors = TOAST_COLORS[t.type] || TOAST_COLORS.info
        return (
          <div
            key={t.id}
            style={{
              background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{colors.icon}</div>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{t.message}</div>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function DialogProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null)
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const confirmDialog = useCallback((message, opts = {}) => {
    return new Promise(resolve => {
      setConfirmState({ message, ...opts, resolve })
    })
  }, [])

  const closeConfirm = useCallback((result) => {
    setConfirmState(state => {
      state?.resolve(result)
      return null
    })
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const notify = useCallback((message, opts = {}) => {
    const id = ++idRef.current
    const duration = opts.duration ?? (opts.type === 'error' ? 6000 : 4000)
    setToasts(t => [...t, { id, message, type: opts.type || 'info' }])
    if (duration > 0) setTimeout(() => dismissToast(id), duration)
    return id
  }, [dismissToast])

  const notifyError = useCallback((message, opts = {}) => notify(message, { ...opts, type: 'error' }), [notify])
  const notifySuccess = useCallback((message, opts = {}) => notify(message, { ...opts, type: 'success' }), [notify])

  return (
    <DialogContext.Provider value={{ confirmDialog, notify, notifyError, notifySuccess }}>
      {children}
      {confirmState && (
        <ConfirmModal
          {...confirmState}
          onConfirm={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </DialogContext.Provider>
  )
}
