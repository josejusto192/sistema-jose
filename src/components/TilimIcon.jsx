import React from 'react'

/**
 * Tilim bell icon — faithful recreation of the official brand mark.
 * Hollow outline bell with sound arcs, wide rim and clapper.
 */
export default function TilimIcon({ size = 32, color = '#00CB53' }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.12)}
      viewBox="0 0 90 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Bell body (evenodd = outer filled, inner hollow) ── */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill={color}
        d="
          M 34 0
          C 29.6 0 26 3.6 26 8
          C 26 9.6 26.4 11 27.2 12.2
          C 15.8 15.6 8 26.4 8 39
          L 6 62
          L 2 70
          L 0 76
          L 64 76
          L 62 70
          L 58 62
          L 56 39
          C 56 26.4 48.2 15.6 36.8 12.2
          C 37.6 11 38 9.6 38 8
          C 38 3.6 34.4 0 34 0 Z

          M 34 22
          C 27.4 22 22 28.4 21 37
          L 19 62
          L 49 62
          L 47 37
          C 46 28.4 40.6 22 34 22 Z
        "
      />

      {/* ── Top knob ── */}
      <circle cx="34" cy="7" r="7" fill={color} />

      {/* ── Bottom rim (wide horizontal bar) ── */}
      <rect x="0" y="70" width="64" height="11" rx="5.5" fill={color} />

      {/* ── Clapper ── */}
      <path
        d="M 26 82 C 26 82 26 94 34 94 C 42 94 42 82 42 82"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Sound wave inner ── */}
      <path
        d="M 58 46 Q 72 36 67 20"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Sound wave outer ── */}
      <path
        d="M 63 54 Q 84 38 78 14"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
