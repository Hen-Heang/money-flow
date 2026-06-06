'use client'

import React, { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { AnimatePresence, motion } from 'framer-motion'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  footer?: React.ReactNode
}

export default function BottomSheet({ isOpen, onClose, children, title, footer }: BottomSheetProps) {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Desktop: spring-animated centered modal ──────────────────────────────
  if (isDesktop) {
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
              className="relative z-10 flex flex-col w-[32rem] rounded-[28px] border border-white/10 shadow-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--color-card-base)', maxHeight: 'min(85vh, 760px)' }}
            >
              {title && (
                <div className="px-6 pt-7 pb-4 shrink-0">
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                    {title}
                  </h2>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6 custom-scrollbar">
                {children}
              </div>
              {footer && (
                <div className="shrink-0 px-6 pb-6 pt-4 mt-2" style={{ borderTop: '1px solid var(--color-border-base)' }}>
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    )
  }

  // ── Mobile: Vaul drawer ──────────────────────────────────────────────────
  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[6px]" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[101] flex flex-col rounded-t-[32px] outline-none"
          style={{
            backgroundColor: 'var(--color-card-base)',
            maxHeight: '92dvh',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1.5 rounded-full opacity-30" style={{ backgroundColor: 'var(--color-text-secondary)' }} />
          </div>

          <Drawer.Title className={title ? 'px-6 pb-4 shrink-0 text-xl font-bold tracking-tight' : 'sr-only'} style={{ color: 'var(--color-text-primary)' }}>
            {title ?? 'Sheet'}
          </Drawer.Title>

          <div
            className="flex-1 overflow-y-auto px-6 custom-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {children}
          </div>

          {footer && (
            <div
              className="shrink-0 px-6 pt-4 mt-2"
              style={{
                borderTop: '1px solid var(--color-border-base)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)',
              }}
            >
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
