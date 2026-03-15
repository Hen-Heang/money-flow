'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, BarChart2, PiggyBank, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
      className="md:hidden"
      style={{
        position: 'fixed',
        bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        left: '16px',
        right: '16px',
        zIndex: 50,
        pointerEvents: 'none', // Allow clicks through the empty space around the floating bar
      }}
    >
      <div 
        className="mx-auto flex h-[68px] max-w-lg items-center justify-between px-2 shadow-2xl"
        style={{
          pointerEvents: 'auto',
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(24px) saturate(210%)',
          WebkitBackdropFilter: 'blur(24px) saturate(210%)',
          borderRadius: '24px',
          border: '0.5px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex h-full flex-1 flex-col items-center justify-center"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
            >
              <motion.div
                whileTap={{ scale: 0.82 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.6 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="relative flex items-center justify-center p-2">
                  {/* Shared Layout Active Background */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="active-tab-glow"
                        className="absolute inset-0 z-0"
                        style={{
                          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 75%)',
                          filter: 'blur(8px)',
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </AnimatePresence>

                  <motion.div
                    animate={{ 
                      scale: isActive ? 1.15 : 1,
                      y: isActive ? -2 : 0 
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                    className="relative z-10"
                  >
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 2}
                      style={{
                        color: isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.45)',
                        filter: isActive ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
                        transition: 'color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </motion.div>
                </div>

                <motion.span
                  animate={{ 
                    opacity: isActive ? 1 : 0.6,
                    scale: isActive ? 1 : 0.95,
                    y: isActive ? 0 : 1
                  }}
                  className="text-[10px] font-black uppercase tracking-[0.12em] leading-none"
                  style={{
                    color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                    textShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.3)' : 'none',
                  }}
                >
                  {label}
                </motion.span>

                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-blue-400"
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                )}
              </motion.div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
