'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, BarChart2, PiggyBank, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transactions', label: 'Transactions', icon: List },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
        background: 'color-mix(in srgb, var(--color-card-base) 86%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid color-mix(in srgb, var(--color-border-base) 88%, white 12%)',
      }}
    >
      <div className="mx-auto grid h-21 max-w-2xl grid-cols-5 items-center gap-0.5 px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex h-full min-w-0 items-center justify-center px-1"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 600, damping: 20, mass: 0.5 }}
                className="relative z-10 flex flex-col items-center justify-center gap-1 rounded-button px-4 py-2"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-active-pill"
                    className="absolute inset-0 -z-10 rounded-button"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-accent-base) 16%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-accent-base) 32%, transparent)',
                    }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  />
                )}
                <Icon
                  className="h-5 w-5"
                  style={{
                    color: isActive ? 'var(--color-accent-base)' : 'var(--color-text-secondary)',
                    transition: 'color 0.18s ease',
                  }}
                />
                <span
                  className="text-[10px] font-medium leading-none"
                  style={{
                    color: isActive ? 'var(--color-accent-base)' : 'var(--color-text-secondary)',
                    transition: 'color 0.18s ease',
                  }}
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
