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
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="fixed z-60 flex items-center justify-center"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        right: 'max(16px, env(safe-area-inset-right, 0px))',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#10b981',
        boxShadow: '0 10px 28px rgba(16,185,129,0.35)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      } as React.CSSProperties}
      aria-label="Add transaction"
    >
      <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
    </motion.button>
  )
}
