'use client'

import { useEffect } from 'react'

// Replaces the entire document (including the root layout) when an error
// escapes every other boundary, so it can't rely on globals.css or the
// design-system CSS variables being available — hence inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error]', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 32,
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#070b14',
            color: '#f4f7fb',
          }}
        >
          <span style={{ fontSize: 48 }}>⚠️</span>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, opacity: 0.6, maxWidth: 320 }}>
              An unexpected error occurred. Please try reloading the app.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 900,
              color: 'white',
              backgroundColor: '#3b82f6',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
