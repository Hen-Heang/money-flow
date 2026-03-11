'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, BarChart2, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transactions', label: 'Transactions', icon: List },
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
        background: 'rgba(17, 24, 39, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--color-border-base)',
      }}
    >
      <div className="flex items-center justify-around h-20">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 h-full"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                className="flex flex-col items-center gap-1"
              >
                <Icon
                  className="w-6 h-6 transition-colors"
                  style={{ color: isActive ? 'var(--color-income-base)' : 'var(--color-text-secondary)' }}
                />
                <span
                  className="text-[10px] font-medium transition-colors"
                  style={{ color: isActive ? 'var(--color-income-base)' : 'var(--color-text-secondary)' }}
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
