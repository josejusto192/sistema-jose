import React, { useId, useState } from 'react'

function InfoIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="0.8" fill="currentColor" />
    </svg>
  )
}

const tooltipBox = (width) => ({
  position: 'absolute',
  background: '#1A1F2B',
  color: '#E2E8F0',
  borderRadius: 8,
  padding: '10px 13px',
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: 'pre-line',
  boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
  zIndex: 200,
  width,
  pointerEvents: 'none',
  textAlign: 'left',
})

const arrowUp = {
  position: 'absolute',
  top: '100%',
  left: 14,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: '6px solid #1A1F2B',
}

const arrowDown = {
  position: 'absolute',
  bottom: '100%',
  left: 14,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderBottom: '6px solid #1A1F2B',
}

/**
 * Standalone info icon that shows a tooltip on hover.
 * dir: 'up' = tooltip above (default), 'down' = tooltip below
 */
export function InfoTooltip({ text, size = 13, width = 230, dir = 'up' }) {
  const [show, setShow] = useState(false)
  const tooltipId = useId()
  if (!text) return null
  const above = dir === 'up'
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', color: 'var(--text3)', cursor: 'default', lineHeight: 1 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      aria-describedby={show ? tooltipId : undefined}
    >
      <InfoIcon size={size} />
      {show && (
        <div id={tooltipId} role="tooltip" style={{
          ...tooltipBox(width),
          ...(above
            ? { bottom: 'calc(100% + 8px)', top: 'auto', left: 0 }
            : { top: 'calc(100% + 8px)', bottom: 'auto', left: 0 }),
        }}>
          {above ? <div style={arrowUp} /> : <div style={arrowDown} />}
          {text}
        </div>
      )}
    </span>
  )
}

/**
 * Wraps any element and shows a tooltip on hover of the whole area.
 */
export function Tooltip({ children, text, width = 230, dir = 'up' }) {
  const [show, setShow] = useState(false)
  const tooltipId = useId()
  if (!text) return <>{children}</>
  const above = dir === 'up'
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocusCapture={() => setShow(true)}
      onBlurCapture={() => setShow(false)}
      aria-describedby={show ? tooltipId : undefined}
    >
      {children}
      {show && (
        <div id={tooltipId} role="tooltip" style={{
          ...tooltipBox(width),
          ...(above
            ? { bottom: 'calc(100% + 8px)', top: 'auto', left: 0 }
            : { top: 'calc(100% + 8px)', bottom: 'auto', left: 0 }),
        }}>
          {above ? <div style={arrowUp} /> : <div style={arrowDown} />}
          {text}
        </div>
      )}
    </div>
  )
}
