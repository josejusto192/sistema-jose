import React, { useState, useRef, useEffect } from 'react'

const TYPE_CFG = {
  lead_fechou:  { color: '#10B981', emoji: '🏆' },
  comissao_paga:{ color: '#F59E0B', emoji: '💰' },
  followup:     { color: '#F59E0B', emoji: '⏰' },
  novo_lead:    { color: '#3B82F6', emoji: '🟢' },
  task_due:     { color: '#8B5CF6', emoji: '📋' },
  default:      { color: '#3B82F6', emoji: '🔔' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `há ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `há ${days}d`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function BellIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

const TYPE_TO_VIEW = {
  lead_fechou:   'leads',
  novo_lead:     'leads',
  task_due:      'agenda',
  followup:      'agenda',
  comissao_paga: 'desempenho',
}

export default function NotificationBell({ notifications, unreadCount, markRead, markAllRead, dropdownAlign = 'right', onNavigate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleClickItem(n) {
    if (!n.read) markRead(n.id)
    setOpen(false)
    const target = TYPE_TO_VIEW[n.type]
    if (target && onNavigate) onNavigate(target)
  }

  return (
    <div ref={ref} className="notification-root">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`notification-trigger${open ? ' is-open' : ''}`}
        aria-label={unreadCount > 0 ? `Notificações: ${unreadCount} não lidas` : 'Notificações'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BellIcon size={17} />
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`notification-panel align-${dropdownAlign}`} role="dialog" aria-label="Central de notificações">
          {/* Header */}
          <div className="notification-header">
            <div className="notification-title-row">
              <span className="notification-title">Notificações</span>
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="notification-read-all"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <div className="notification-empty-icon">🔔</div>
                Nenhuma notificação ainda
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CFG[n.type] || TYPE_CFG.default
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClickItem(n)}
                    className={`notification-item${n.read ? '' : ' is-unread'}`}
                  >
                    {/* Icon */}
                    <div className="notification-item-icon" style={{ background: cfg.color + '18' }}>
                      {cfg.emoji}
                    </div>

                    {/* Content */}
                    <div className="notification-item-copy">
                      <div className="notification-item-head">
                        <div className="notification-item-title" style={{ fontWeight: n.read ? 450 : 700 }}>
                          {n.title}
                        </div>
                        <span className="notification-item-time">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <div className="notification-item-body">
                          {n.body}
                        </div>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div className="notification-unread-dot" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
