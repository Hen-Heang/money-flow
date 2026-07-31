'use client'

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="text-6xl">⚠️</span>
      <div>
        <h2 className="text-xl font-black mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Something went wrong
        </h2>
        <p className="text-sm opacity-50 max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
          An unexpected error occurred. Please try again.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-2xl text-sm font-black text-white"
        style={{ backgroundColor: 'var(--color-accent-base)' }}
      >
        Try again
      </button>
    </div>
  )
}
