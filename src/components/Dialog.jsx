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
      className="overlay-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="dialog-copy">
          <div id="confirm-dialog-title" className="dialog-title">{title || 'Confirmar ação'}</div>
          <div className="dialog-message">{message}</div>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            onClick={onCancel}
            className="dialog-button"
          >
            {cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`dialog-button is-primary${danger ? ' is-danger' : ''}`}
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
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(t => {
        const colors = TOAST_COLORS[t.type] || TOAST_COLORS.info
        return (
          <div key={t.id} className={`toast-card is-${t.type || 'info'}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <div className="toast-icon">{colors.icon}</div>
            <div className="toast-message">{t.message}</div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="toast-dismiss"
              aria-label="Fechar aviso"
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
