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
  const [isMounted, setIsMounted] = React.useState(false)
  const [showMore, setShowMore] = useState(false)

  React.useEffect(() => { setIsMounted(true) }, [])

  const isMoreActive = isMounted && MORE_HREFS.includes(pathname)

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
              className="md:hidden fixed bottom-0 inset-x-0 z-50 rounded-t-[32px] overflow-hidden"
              style={{
                background: 'rgba(10, 15, 26, 0.97)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-5">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">More</p>
                <button
                  onClick={() => setShowMore(false)}
                  className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X size={15} strokeWidth={2.5} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>

              {/* Items */}
              <div className="px-4 space-y-2">
                {MORE_ITEMS.map(({ href, label, icon: Icon, desc }) => {
                  const isActive = isMounted && pathname === href
                  return (
                    <motion.button
                      key={href}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleMoreNav(href)}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all"
                      style={{
                        background: isActive ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)' }}
                      >
                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.5)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-black" style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.9)' }}>{label}</p>
                        <p className="text-[11px] font-medium opacity-40">{desc}</p>
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
          {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
            const isActive = isMounted && pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
              >
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="flex items-center justify-center transition-all duration-300"
                    style={{
                      width: 48, height: 32, borderRadius: 16,
                      background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                      boxShadow: isActive ? '0 0 15px rgba(59,130,246,0.1)' : 'none',
                    }}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.4)' }} />
                  </div>
                  <span className="transition-all duration-300 font-bold" style={{ fontSize: 10, lineHeight: 1, color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.3)' }}>
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

          {/* More button */}
          <button
            onClick={() => setShowMore(v => !v)}
            className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="flex items-center justify-center transition-all duration-300"
                style={{
                  width: 48, height: 32, borderRadius: 16,
                  background: (isMoreActive || showMore) ? 'rgba(59,130,246,0.15)' : 'transparent',
                  boxShadow: (isMoreActive || showMore) ? '0 0 15px rgba(59,130,246,0.1)' : 'none',
                }}
              >
                <Grid3X3 size={22} strokeWidth={(isMoreActive || showMore) ? 2.5 : 2} style={{ color: (isMoreActive || showMore) ? '#60a5fa' : 'rgba(255,255,255,0.4)' }} />
              </div>
              <span className="transition-all duration-300 font-bold" style={{ fontSize: 10, lineHeight: 1, color: (isMoreActive || showMore) ? '#60a5fa' : 'rgba(255,255,255,0.3)' }}>
                More
              </span>
            </motion.div>
            {isMoreActive && !showMore && (
              <motion.span
                layoutId="tab-dot"
                className="absolute bottom-1.5 w-1 h-1 rounded-full"
                style={{ background: '#60a5fa', boxShadow: '0 0 8px #60a5fa' }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
