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
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.05, y: -2 }}
      transition={{ 
        type: 'spring', 
        stiffness: 400, 
        damping: 25,
        mass: 0.8
      }}
      onClick={onClick}
      className="fixed z-60 flex items-center justify-center shadow-2xl"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        right: 'max(20px, env(safe-area-inset-right, 0px))',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      } as React.CSSProperties}
      aria-label="Add transaction"
    >
      <Plus className="h-8 w-8 text-white" strokeWidth={2.5} />
    </motion.button>
  )
}
