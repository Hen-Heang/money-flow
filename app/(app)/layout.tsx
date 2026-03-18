import React from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TabBar from '@/components/layout/TabBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-35 h-75"
        style={{
          background:
            'radial-gradient(55% 80% at 20% 10%, color-mix(in srgb, var(--color-accent-base) 18%, transparent), transparent 70%), radial-gradient(45% 70% at 80% 0%, color-mix(in srgb, var(--color-income-base) 16%, transparent), transparent 72%)',
        }}
      />

      <Sidebar />

      <div className="relative z-10 flex min-h-screen flex-1 flex-col md:ml-64 w-full">
        <main
          className="relative flex-1 w-full"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          } as React.CSSProperties}
        >
          {children}
        </main>
      </div>

      <TabBar />
    </div>
  )
}
