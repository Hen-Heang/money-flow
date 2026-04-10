'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  footer?: React.ReactNode
}

export default function BottomSheet({ isOpen, onClose, children, title, footer }: BottomSheetProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null)
  const [canDrag, setCanDrag] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false)
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    const handleChange = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardHeight(Math.max(0, offset))
      setVisibleHeight(Math.round(vv.height))
    }

    handleChange()
    vv.addEventListener('resize', handleChange)
    vv.addEventListener('scroll', handleChange)
    return () => {
      vv.removeEventListener('resize', handleChange)
      vv.removeEventListener('scroll', handleChange)
      setKeyboardHeight(0)
      setVisibleHeight(null)
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center p-0 md:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
          />

          {/* Main Modal/Sheet */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.95, y: 10 } : { y: '100%' }}
            animate={
              isDesktop
                ? { opacity: 1, scale: 1, y: 0 }
                : { y: keyboardHeight > 0 ? -keyboardHeight : 0 }
            }
            exit={isDesktop ? { opacity: 0, scale: 0.95, y: 10 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
            drag={!isDesktop && canDrag ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose()
            }}
            className={`
              relative flex flex-col overflow-hidden glass-card shadow-2xl
              ${isDesktop
                ? 'w-[32rem] rounded-[28px] border border-white/10'
                : 'w-full rounded-t-[32px] border-t border-white/10'
              }
            `}
            style={{
              backgroundColor: 'var(--color-card-base)',
              maxHeight: !isDesktop && keyboardHeight > 0 && visibleHeight
                ? `${visibleHeight}px`
                : isDesktop ? 'min(85vh, 760px)' : 'min(92dvh, 760px)',
              paddingBottom: isDesktop ? '24px' : 'calc(env(safe-area-inset-bottom, 16px) + 8px)',
            }}
          >
            {/* Handle Bar (Mobile Only) */}
            {!isDesktop && (
              <div className="flex items-center justify-center py-3 shrink-0">
                <div
                  className="w-10 rounded-full h-1.5"
                  style={{ backgroundColor: 'var(--color-text-secondary)', opacity: 0.3 }}
                />
              </div>
            )}

            {/* Title Header */}
            {title && (
              <div className={`px-6 shrink-0 ${isDesktop ? 'pt-7 pb-4' : 'pb-4'}`}>
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                  {title}
                </h2>
              </div>
            )}

            {/* Scrollable Content */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 custom-scrollbar"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              onScroll={() => {
                const el = scrollRef.current
                setCanDrag(!el || el.scrollTop === 0)
              }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 px-6 pb-2 pt-4 mt-2" style={{ borderTop: '1px solid var(--color-border-base)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
