'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, BarChart2, PiggyBank, Settings } from 'lucide-react'
import Logo from '@/components/ui/Logo'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transactions', label: 'Transactions', icon: List },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fade-up fixed left-0 top-0 hidden h-screen w-64 p-6 md:block">
      <div
        className="surface-card flex h-full flex-col p-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-card-base) 94%, transparent)' }}
      >
        <div className="mb-8 flex items-center gap-3 rounded-button px-2 py-2">
          <Logo size={38} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--color-text-secondary)' }}>Finance</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Money Flow</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="surface-row flex items-center gap-3 rounded-xl px-3 py-3"
                style={{
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--color-accent-base) 14%, transparent)' : 'transparent',
                  color: isActive ? 'var(--color-accent-base)' : 'var(--color-text-secondary)',
                  border: `1px solid ${isActive ? 'color-mix(in srgb, var(--color-accent-base) 30%, transparent)' : 'transparent'}`,
                }}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
