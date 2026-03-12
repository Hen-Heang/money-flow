import React from 'react'
import ChatBot from '@/components/ai/ChatBot'
import Sidebar from '@/components/layout/Sidebar'
import TabBar from '@/components/layout/TabBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-35 h-75"
        style={{
          background:
            'radial-gradient(55% 80% at 20% 10%, color-mix(in srgb, var(--color-accent-base) 18%, transparent), transparent 70%), radial-gradient(45% 70% at 80% 0%, color-mix(in srgb, var(--color-income-base) 16%, transparent), transparent 72%)',
        }}
      />

      <Sidebar />

      <div className="relative z-10 flex min-h-screen flex-1 flex-col md:ml-64">
        <div
          className="sticky top-0 z-30 px-4 pb-2 pt-3 md:px-6 lg:px-8"
          style={{
            paddingTop: 'max(12px, calc(env(safe-area-inset-top, 0px) + 12px))',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 96%, transparent), color-mix(in srgb, var(--color-bg) 72%, transparent), transparent)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex justify-end">
            <ChatBot />
          </div>
        </div>

        <main
          className="relative min-h-screen flex-1 px-0 md:px-2 lg:px-4"
          style={{
            paddingTop: 'max(4px, env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7.25rem)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {children}
        </main>
      </div>

      <TabBar />
    </div>
  )
}
