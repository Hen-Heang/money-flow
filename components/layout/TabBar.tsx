'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, PiggyBank, Wallet, BarChart2 } from 'lucide-react'
import { motion } from 'framer-motion'

const PRIMARY_TABS = [
  { href: '/dashboard',    label: 'Home',      icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: List },
  { href: '/savings',      label: 'Savings',   icon: PiggyBank },
  { href: '/budget',       label: 'Budget',    icon: Wallet },
  { href: '/analytics',   label: 'Analytics', icon: BarChart2 },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center lg:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)', paddingLeft: 12, paddingRight: 12 }}
    >
      <div
        className="flex w-full max-w-md items-center justify-around"
        style={{
          height: 68,
          background: 'color-mix(in srgb, var(--color-card-base) 94%, transparent)',
          backdropFilter: 'blur(40px) saturate(220%)',
          WebkitBackdropFilter: 'blur(40px) saturate(220%)',
          borderRadius: 26,
          border: '1px solid var(--color-border-base)',
          boxShadow: '0 18px 45px -20px rgba(0,0,0,0.72), inset 0 1px 1px rgba(255,255,255,0.06)',
        }}
      >
        {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex h-full flex-1 flex-col items-center justify-center gap-1"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="flex items-center justify-center transition-[background-color,transform] duration-200"
                  style={{
                    width: 42, height: 28, borderRadius: 14,
                    background: isActive ? 'color-mix(in srgb, var(--color-accent-base) 13%, transparent)' : 'transparent',
                  }}
                >
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-[color,transform] ${isActive ? 'scale-105 text-[var(--color-accent-base)]' : 'text-[var(--color-text-secondary)] opacity-65'}`}
                  />
                </div>
                <span
                  className={`font-bold tracking-tight transition-colors duration-200 ${isActive ? 'text-[var(--color-accent-base)]' : 'text-[var(--color-text-secondary)] opacity-65'}`}
                  style={{ fontSize: label === 'Transactions' ? 9 : 10 }}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
