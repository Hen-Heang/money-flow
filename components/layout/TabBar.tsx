'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, PiggyBank, BarChart2, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

const TABS = [
  { href: '/dashboard',    label: 'Home',     icon: LayoutDashboard },
  { href: '/transactions', label: 'History',  icon: List },
  { href: '/savings',      label: 'Goals',    icon: PiggyBank },
  { href: '/analytics',    label: 'Analytics',icon: BarChart2 },
  { href: '/settings',     label: 'Settings', icon: Settings },
]

export default function TabBar() {
  const pathname = usePathname()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center pb-safe"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', paddingLeft: 20, paddingRight: 20 }}
    >
      <div
        className="w-full max-w-sm flex items-center justify-around shadow-2xl"
        style={{
          height: 72,
          background: 'rgba(10, 15, 26, 0.85)',
          backdropFilter: 'blur(32px) saturate(210%)',
          WebkitBackdropFilter: 'blur(32px) saturate(210%)',
          borderRadius: 32,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = isMounted && pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="flex items-center justify-center transition-all duration-300"
                  style={{
                    width: 48,
                    height: 32,
                    borderRadius: 16,
                    background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                    boxShadow: isActive ? '0 0 15px rgba(59,130,246,0.1)' : 'none',
                  }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}
                  />
                </div>

                <span
                  className="transition-all duration-300 font-black uppercase tracking-[0.1em]"
                  style={{
                    fontSize: 9,
                    lineHeight: 1,
                    color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {label}
                </span>
              </motion.div>

              {isActive && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute bottom-1.5 w-1 h-1 rounded-full"
                  style={{ background: '#60a5fa', boxShadow: '0 0 8px #60a5fa' }}
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
