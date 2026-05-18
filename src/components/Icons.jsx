import React from 'react'

export function IconMail({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.4" />
      <path d="M1.5 3.5L8 9l6.5-5.5" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IconPhone({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 2h3l1.5 3.5-1.8 1.1a8.5 8.5 0 0 0 3.7 3.7L10.5 8.5 14 10v3c0 .6-.5 1-1 1A12 12 0 0 1 2 3c0-.5.4-1 1-1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IconFileText({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 2v3h3" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="5" y1="8" x2="11" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5" y1="11" x2="9" y2="11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconClock({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 1.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconLink({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-4.95l-1 1" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 4.95l1-1" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconMoon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 10A6 6 0 0 1 6 2.5 6 6 0 1 0 13.5 10z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSun({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.4" />
      <line x1="8" y1="1" x2="8" y2="2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="13.5" x2="8" y2="15" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1" y1="8" x2="2.5" y2="8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="13.5" y1="8" x2="15" y2="8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="3.05" y1="3.05" x2="4.1" y2="4.1" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11.9" y1="11.9" x2="12.95" y2="12.95" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="3.05" y1="12.95" x2="4.1" y2="11.9" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11.9" y1="4.1" x2="12.95" y2="3.05" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconSearch({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke={color} strokeWidth="1.4" />
      <line x1="10" y1="10" x2="14" y2="14" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconCamera({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 5h14v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5z" stroke={color} strokeWidth="1.4" />
      <path d="M5 5l1.5-3h3L11 5" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="9" r="2.5" stroke={color} strokeWidth="1.3" />
    </svg>
  )
}

export function IconInbox({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="26" height="20" rx="2.5" stroke={color} strokeWidth="1.8" />
      <path d="M3 19h7l2.5 3.5h7L22 19h7" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function IconWhatsApp({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5A6.5 6.5 0 0 0 2.2 11L1.5 14.5l3.6-.7A6.5 6.5 0 1 0 8 1.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.5 6.2c.1.8.5 1.8 1.3 2.6.8.8 1.8 1.2 2.6 1.3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconGrid({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill={color} opacity="0.9" />
    </svg>
  )
}

export function IconList({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="2" rx="1" fill={color} opacity="0.9" />
      <rect x="1" y="7" width="14" height="2" rx="1" fill={color} opacity="0.9" />
      <rect x="1" y="11" width="14" height="2" rx="1" fill={color} opacity="0.9" />
    </svg>
  )
}

export function IconContract({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke={color} strokeWidth="1.5" opacity="0.9" />
      <rect x="4.5" y="4.5" width="7" height="1.2" rx="0.6" fill={color} opacity="0.9" />
      <rect x="4.5" y="7" width="7" height="1.2" rx="0.6" fill={color} opacity="0.7" />
      <rect x="4.5" y="9.5" width="4" height="1.2" rx="0.6" fill={color} opacity="0.5" />
    </svg>
  )
}

export function IconCheck({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7l3.5 3.5L12 3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconX({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="4" y1="4" x2="12" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="4" x2="4" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconArrowLeft({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L5 8l5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconPlus({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="8" y1="2" x2="8" y2="14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconTrash({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 4h11M6 4V2.5h3V4M5 4v8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconEdit({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9.5 2L12 4.5l-7 7H2.5V9l7-7z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IconMenu({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="2" y1="4" x2="14" y2="4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="12" x2="14" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconCopy({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="8" height="9" rx="1.2" stroke={color} strokeWidth="1.3" />
      <path d="M2 10V2.5A1.5 1.5 0 0 1 3.5 1H10" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IconMapPin({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1a4 4 0 0 1 4 4c0 3-4 8-4 8S3 8 3 5a4 4 0 0 1 4-4z" stroke={color} strokeWidth="1.3" />
      <circle cx="7" cy="5" r="1.3" fill={color} />
    </svg>
  )
}

export function IconLogOut({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 5l3 3-3 3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="8" x2="6" y2="8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconTag({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="5.5" cy="5.5" r="1" fill={color} />
    </svg>
  )
}

export function IconHistory({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8A5.5 5.5 0 1 0 4 4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 2v3h3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5.5V8l2 1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSettings({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.4" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconUser({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.5" r="3" stroke={color} strokeWidth="1.4" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconBarChart({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="8" width="3" height="7" rx="1" fill={color} opacity="0.9" />
      <rect x="6" y="5" width="3" height="10" rx="1" fill={color} opacity="0.9" />
      <rect x="11" y="2" width="3" height="13" rx="1" fill={color} opacity="0.9" />
    </svg>
  )
}

export function IconBell({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5A1 1 0 0 0 7 2.5v.35A4.5 4.5 0 0 0 3.5 7v2.5L2 11h12l-1.5-1.5V7A4.5 4.5 0 0 0 9 2.85V2.5a1 1 0 0 0-1-1Z" fill={color} opacity="0.9"/>
      <path d="M6.5 11.5a1.5 1.5 0 0 0 3 0" stroke={color} strokeWidth="1" fill="none"/>
    </svg>
  )
}

export function IconTrendUp({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="1,10 5,6 8,8 13,3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="9,3 13,3 13,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconTrendDown({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="1,4 5,8 8,6 13,11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="9,11 13,11 13,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconKanban({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="5" height="18" rx="1" />
      <rect x="9.5" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="5" height="15" rx="1" />
    </svg>
  )
}
