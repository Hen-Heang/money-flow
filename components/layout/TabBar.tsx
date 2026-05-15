'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, List, PiggyBank, Wallet, BarChart2, FileText, Settings, Grid3X3, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const PRIMARY_TABS = [
  { href: '/dashboard',    label: 'Home',    icon: LayoutDashboard },
  { href: '/transactions', label: 'History', icon: List },
  { href: '/savings',      label: 'Goals',   icon: PiggyBank },
  { href: '/budget',       label: 'Budget',  icon: Wallet },
]

const MORE_ITEMS = [
  { href: '/analytics', label: 'Analytics', icon: BarChart2,     desc: 'Trends, charts & insights' },
  { href: '/report',    label: 'Report',    icon: FileText,      desc: 'Monthly income & expense' },
  { href: '/settings',  label: 'Settings',  icon: Settings,      desc: 'Profile, categories & more' },
]

const MORE_HREFS = MORE_ITEMS.map(i => i.href)

export default function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)

  const isMoreActive = MORE_HREFS.includes(pathname)

  const handleMoreNav = (href: string) => {
    setShowMore(false)
    router.push(href)
  }

  return (
    <>
      {/* More sheet backdrop */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              key="sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320, mass: 0.8 }}
              className="md:hidden fixed bottom-0 inset-x-0 z-50 rounded-t-[32px] overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(10, 15, 26, 0.98)',
                backdropFilter: 'blur(40px) saturate(200%)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                borderLeft: '1px solid rgba(255,255,255,0.05)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 rounded-full bg-white/10" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-7 pt-5 pb-6">
                <p className="text-tiny opacity-40 font-black tracking-[0.4em]">Intelligence</p>
                <button
                  onClick={() => setShowMore(false)}
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center active:scale-90 transition-all border border-white/5"
                >
                  <X size={16} strokeWidth={3} className="text-white/40" />
                </button>
              </div>

              {/* Items */}
              <div className="px-5 space-y-3">
                {MORE_ITEMS.map(({ href, label, icon: Icon, desc }) => {
                  const isActive = pathname === href
                  return (
                    <motion.button
                      key={href}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleMoreNav(href)}
                      className="w-full flex items-center gap-5 px-5 py-5 rounded-[24px] text-left transition-all group relative overflow-hidden"
                      style={{
                        background: isActive ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110"
                        style={{ background: isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)' }}
                      >
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-blue-400' : 'text-white/40'} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-base font-black tracking-tight ${isActive ? 'text-blue-400' : 'text-white/90'}`}>{label}</p>
                        <p className="text-xs font-medium opacity-40 mt-0.5">{desc}</p>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', paddingLeft: 20, paddingRight: 20 }}
      >
        <div
          className="w-full max-w-sm flex items-center justify-around shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]"
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
                      width: 52, height: 34, borderRadius: 17,
                      background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                      boxShadow: isActive ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                    }}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-all ${isActive ? 'text-blue-400 scale-110' : 'text-white/40'}`} />
                  </div>
                  <span className={`transition-all duration-400 font-black tracking-tight ${isActive ? 'text-blue-400' : 'text-white/30'}`} style={{ fontSize: 10 }}>
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

          {/* More button */}
          <button
            onClick={() => setShowMore(v => !v)}
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
                  width: 52, height: 34, borderRadius: 17,
                  background: (isMoreActive || showMore) ? 'rgba(59,130,246,0.12)' : 'transparent',
                  boxShadow: (isMoreActive || showMore) ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                }}
              >
                <Grid3X3 size={22} strokeWidth={(isMoreActive || showMore) ? 2.5 : 2} className={`transition-all ${(isMoreActive || showMore) ? 'text-blue-400 scale-110' : 'text-white/40'}`} />
              </div>
              <span className={`transition-all duration-400 font-black tracking-tight ${(isMoreActive || showMore) ? 'text-blue-400' : 'text-white/30'}`} style={{ fontSize: 10 }}>
                More
              </span>
            </motion.div>
            {isMoreActive && !showMore && (
              <motion.span
                layoutId="tab-dot"
                className="absolute bottom-1.5 w-1 h-1 rounded-full"
                style={{ background: '#60a5fa', boxShadow: '0 0 10px #60a5fa' }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
