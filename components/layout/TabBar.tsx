'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, BarChart2, PiggyBank, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transactions', label: 'History', icon: List },
  { href: '/savings', label: 'Goals', icon: PiggyBank },
  { href: '/analytics', label: 'Data', icon: BarChart2 },
  { href: '/settings', label: 'Menu', icon: Settings },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-6 pb-6 pointer-events-none"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div 
        className="mx-auto flex h-[62px] max-w-md items-center justify-around shadow-2xl pointer-events-auto"
        style={{
          background: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex h-full flex-col items-center justify-center px-1"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-0.5"
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-500/10' : ''}`}>
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    style={{
                      color: isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.35)',
                    }}
                  />
                </div>
                <span
                  className={`text-[8px] font-bold uppercase tracking-[0.05em] transition-all duration-300 ${isActive ? 'text-white opacity-100' : 'text-white/20 opacity-50'}`}
                >
                  {label}
                </span>
              </motion.div>
              {isActive && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute bottom-1.5 w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

