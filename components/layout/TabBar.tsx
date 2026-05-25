'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, PiggyBank, Wallet, BarChart2 } from 'lucide-react'
import { motion } from 'framer-motion'

const PRIMARY_TABS = [
  { href: '/dashboard',    label: 'Home',      icon: LayoutDashboard },
  { href: '/transactions', label: 'History',   icon: List },
  { href: '/savings',      label: 'Goals',     icon: PiggyBank },
  { href: '/budget',       label: 'Budget',    icon: Wallet },
  { href: '/analytics',   label: 'Analytics', icon: BarChart2 },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', paddingLeft: 20, paddingRight: 20 }}
    >
      <div
        className="w-full max-w-sm flex items-center justify-around"
        style={{
          height: 76,
          background: 'rgba(10, 15, 26, 0.88)',
          backdropFilter: 'blur(40px) saturate(220%)',
          WebkitBackdropFilter: 'blur(40px) saturate(220%)',
          borderRadius: 38,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)',
        }}
      >
        {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="flex items-center justify-center transition-all duration-400"
                  style={{
                    width: 46, height: 30, borderRadius: 15,
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                    boxShadow: isActive ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                  }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-all ${isActive ? 'text-blue-400 scale-110' : 'text-white/40'}`} />
                </div>
                <span className={`transition-all duration-400 font-black tracking-tight ${isActive ? 'text-blue-400' : 'text-white/30'}`} style={{ fontSize: 9 }}>
                  {label}
                </span>
              </motion.div>
              {isActive && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute bottom-1.5 w-1 h-1 rounded-full"
                  style={{ background: '#60a5fa', boxShadow: '0 0 10px #60a5fa' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
