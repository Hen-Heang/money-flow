'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

interface FABProps {
  onClick: () => void
}

export default function FAB({ onClick }: FABProps) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.05, y: -1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 500, 
        damping: 30,
        mass: 0.8
      }}
      onClick={onClick}
      className="fixed z-60 flex items-center justify-center shadow-[0_12px_30px_rgba(0,0,0,0.3)] active:shadow-none lg:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
        right: 'max(18px, env(safe-area-inset-right, 0px))',
        width: '54px',
        height: '54px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, var(--color-accent-base) 0%, color-mix(in srgb, var(--color-accent-base) 78%, black) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
        touchAction: 'manipulation',
      } as React.CSSProperties}
      aria-label="Add transaction"
    >
      <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
    </motion.button>
  )
}
