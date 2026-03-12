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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag={canDrag ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose()
            }}
            className="fixed left-0 right-0 z-50 mx-auto flex flex-col"
            style={{
              bottom: keyboardHeight > 0
                ? keyboardHeight
                : isDesktop
                  ? 0
                  : 'calc(80px + env(safe-area-inset-bottom, 0px))',
              transition: 'bottom 0.25s ease-out',
              backgroundColor: 'var(--color-card-base)',
              borderRadius: '24px 24px 0 0',
              width: 'min(100%, 32rem)',
              maxHeight: keyboardHeight > 0 && visibleHeight
                ? `${visibleHeight}px`
                : 'min(82dvh, 760px)',
              overflow: 'hidden',
              paddingBottom: keyboardHeight > 0 || !isDesktop ? '8px' : 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            <div className="flex items-center justify-center py-3 shrink-0">
              <div
                className="w-10 rounded-full"
                style={{ height: '5px', backgroundColor: 'var(--color-text-secondary)', opacity: 0.5 }}
              />
            </div>
            {title && (
              <div className="px-6 pb-4">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
              </div>
            )}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              onScroll={() => {
                const el = scrollRef.current
                setCanDrag(!el || el.scrollTop === 0)
              }}
            >
              {children}
            </div>
            {footer && (
              <div className="shrink-0 px-4 pb-2 pt-3" style={{ borderTop: '1px solid var(--color-border-base)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
