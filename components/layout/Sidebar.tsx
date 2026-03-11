'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, BarChart2, Settings, TrendingUp } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transactions', label: 'Transactions', icon: List },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 p-6"
      style={{
        backgroundColor: 'var(--color-card-base)',
        borderRight: '1px solid var(--color-border-base)',
      }}
    >
      <div className="flex items-center gap-3 mb-10">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-income-base)' }}
        >
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Money Flow</span>
      </div>
      <nav className="flex flex-col gap-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 rounded-[12px] transition-colors"
              style={{
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                color: isActive ? 'var(--color-income-base)' : 'var(--color-text-secondary)',
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
