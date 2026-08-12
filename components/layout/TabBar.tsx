'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, PiggyBank, Wallet, BarChart2 } from 'lucide-react'
import { motion } from 'framer-motion'

const PRIMARY_TABS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: LayoutDashboard,
    iconClass: 'text-blue-500',
    tintClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/25',
    dotClass: 'bg-blue-500',
  },
  {
    href: '/transactions',
    label: 'Transactions',
    icon: List,
    iconClass: 'text-cyan-500',
    tintClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/25',
    dotClass: 'bg-cyan-500',
  },
  {
    href: '/savings',
    label: 'Savings',
    icon: PiggyBank,
    iconClass: 'text-emerald-500',
    tintClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/25',
    dotClass: 'bg-emerald-500',
  },
  {
    href: '/budget',
    label: 'Budget',
    icon: Wallet,
    iconClass: 'text-amber-500',
    tintClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
    dotClass: 'bg-amber-500',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart2,
    iconClass: 'text-fuchsia-500',
    tintClass: 'bg-fuchsia-500/10',
    borderClass: 'border-fuchsia-500/25',
    dotClass: 'bg-fuchsia-500',
  },
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
        {PRIMARY_TABS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
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
                  className={`relative flex h-8 w-11 items-center justify-center rounded-2xl border transition-[background-color,border-color,transform,box-shadow] duration-200 ${item.tintClass} ${
                    isActive
                      ? `scale-105 shadow-sm ${item.borderClass}`
                      : 'border-transparent opacity-80'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    size={19}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`${item.iconClass} transition-[opacity,transform] duration-200 ${
                      isActive ? 'scale-105 opacity-100' : 'opacity-75'
                    }`}
                  />
                  {isActive && (
                    <motion.span
                      layoutId="tab-active-dot"
                      aria-hidden="true"
                      className={`absolute -bottom-1 h-1 w-1 rounded-full ${item.dotClass}`}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                </div>

                <span
                  className={`font-bold tracking-tight transition-[color,opacity] duration-200 ${
                    isActive ? `${item.iconClass} opacity-100` : 'text-[var(--color-text-secondary)] opacity-65'
                  }`}
                  style={{ fontSize: item.label === 'Transactions' ? 9 : 10 }}
                >
                  {item.label}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
