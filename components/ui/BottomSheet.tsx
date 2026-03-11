'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export default function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
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
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose()
            }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex flex-col"
            style={{
              backgroundColor: 'var(--color-card-base)',
              borderRadius: '24px 24px 0 0',
              width: 'min(100%, 32rem)',
              maxHeight: 'min(82dvh, 760px)',
              overflow: 'hidden',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            <div className="flex items-center justify-center py-3 flex-shrink-0">
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
              className="flex-1 overflow-y-auto"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
