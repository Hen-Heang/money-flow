import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
    >
      <span className="text-6xl">🧭</span>
      <div>
        <h1 className="text-2xl font-black mb-2">Page not found</h1>
        <p className="text-sm opacity-50 max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="px-6 py-3 rounded-2xl text-sm font-black text-white"
        style={{ backgroundColor: 'var(--color-accent-base)' }}
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
