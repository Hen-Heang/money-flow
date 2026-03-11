'use client'

interface LogoProps {
  size?: number
  className?: string
  showWordmark?: boolean
}

export default function Logo({ size = 80, className = '', showWordmark = false }: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Money Flow logo"
      role="img"
    >
      <defs>
        <linearGradient id="money-flow-bg" x1="12" y1="10" x2="84" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14F195" />
          <stop offset="0.52" stopColor="#10B981" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="money-flow-accent" x1="28" y1="22" x2="66" y2="68" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2E8F0" />
          <stop offset="1" stopColor="#BFDBFE" />
        </linearGradient>
      </defs>

      <rect x="8" y="8" width="80" height="80" rx="24" fill="#08111F" />
      <rect x="10" y="10" width="76" height="76" rx="22" fill="url(#money-flow-bg)" />
      <path
        d="M29 57.5V39.5C29 37.567 30.567 36 32.5 36H42.253C43.747 36 45.078 36.949 45.559 38.364L48.154 46L54.017 28.743C54.512 27.286 55.882 26.306 57.42 26.253C58.959 26.201 60.392 27.086 60.983 28.506L64.916 37.957H72.5C74.433 37.957 76 39.524 76 41.457V57.5C76 59.433 74.433 61 72.5 61H60.276C58.842 61 57.553 60.127 57.019 58.797L55.355 54.654L50.231 68.981C49.724 70.398 48.388 71.354 46.884 71.396C45.382 71.44 43.993 70.559 43.408 69.174L38.313 57.102L37.554 58.873C37.001 60.164 35.731 61 34.326 61H32.5C30.567 61 29 59.433 29 57.5Z"
        fill="#07101C"
        fillOpacity="0.22"
      />
      <path
        d="M29 55V39.5C29 37.567 30.567 36 32.5 36H40.669C42.162 36 43.493 36.947 43.976 38.36L46.078 44.52L53.598 24.774C54.14 23.353 55.523 22.428 57.041 22.503C58.561 22.577 59.847 23.633 60.685 25.38L66.631 37.78C67.214 38.996 68.444 39.772 69.792 39.772H75.5"
        stroke="#07101C"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 55V39.5C29 37.567 30.567 36 32.5 36H40.669C42.162 36 43.493 36.947 43.976 38.36L46.078 44.52L53.598 24.774C54.14 23.353 55.523 22.428 57.041 22.503C58.561 22.577 59.847 23.633 60.685 25.38L66.631 37.78C67.214 38.996 68.444 39.772 69.792 39.772H75.5"
        stroke="url(#money-flow-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M33 61.5H42.4C43.828 61.5 45.113 62.365 45.655 63.686L47.156 67.34L53.847 49.613C54.374 48.217 55.704 47.281 57.195 47.247C58.684 47.213 60.056 48.089 60.647 49.46L62.962 54.833C63.517 56.121 64.786 56.957 66.189 56.957H75.5"
        stroke="#07101C"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M33 61.5H42.4C43.828 61.5 45.113 62.365 45.655 63.686L47.156 67.34L53.847 49.613C54.374 48.217 55.704 47.281 57.195 47.247C58.684 47.213 60.056 48.089 60.647 49.46L62.962 54.833C63.517 56.121 64.786 56.957 66.189 56.957H75.5"
        stroke="url(#money-flow-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (!showWordmark) {
    return mark
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {mark}
      <div className="leading-none">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--color-text-secondary)' }}>
          Personal Finance
        </div>
        <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Money Flow
        </div>
      </div>
    </div>
  )
}
