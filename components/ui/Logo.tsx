'use client'

import { useId } from 'react'

interface LogoProps {
  size?: number
  className?: string
  showWordmark?: boolean
}

export default function Logo({ size = 80, className = '', showWordmark = false }: LogoProps) {
  const id = `money-flow-${useId().replace(/:/g, '')}`
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={showWordmark ? undefined : className}
      aria-hidden={showWordmark || undefined}
      aria-label={showWordmark ? undefined : 'Money Flow logo'}
      role={showWordmark ? undefined : 'img'}
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-surface`} x1="16" y1="12" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#111827" />
          <stop offset="0.5" stopColor="#0B2440" />
          <stop offset="1" stopColor="#083344" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="18" y1="10" x2="78" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#60A5FA" stopOpacity="0.1" />
          <stop offset="1" stopColor="#34D399" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${id}-flow`} x1="21" y1="64" x2="79" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="0.48" stopColor="#ECFDF5" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>

      <rect x="5" y="5" width="86" height="86" rx="28" fill="#020617" />
      <rect x="7" y="7" width="82" height="82" rx="26" fill={`url(#${id}-surface)`} />
      <rect
        x="7.75"
        y="7.75"
        width="80.5"
        height="80.5"
        rx="25.25"
        stroke={`url(#${id}-edge)`}
        strokeWidth="1.5"
      />

      <path
        d="M23 63V37L39 56L49 40L59 55L77 32"
        stroke="#020617"
        strokeOpacity="0.42"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0 2)"
      />
      <path
        d="M23 63V37L39 56L49 40L59 55L77 32"
        stroke={`url(#${id}-flow)`}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M66 32H77V43"
        stroke="#60A5FA"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (!showWordmark) {
    return mark
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} aria-label="Money Flow">
      {mark}
      <div className="leading-none">
        <div className="text-xl font-black tracking-[-0.045em]" style={{ color: 'var(--color-text-primary)' }}>
          Money Flow
        </div>
        <div
          className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Money in motion
        </div>
      </div>
    </div>
  )
}
