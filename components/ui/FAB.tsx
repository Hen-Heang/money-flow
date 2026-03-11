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
      whileHover={{ scale: 1.04, y: -1 }}
      onClick={onClick}
      className="fixed z-60 flex items-center justify-center"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)',
        right: 'max(16px, env(safe-area-inset-right, 0px))',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
        boxShadow: '0 12px 32px color-mix(in srgb, var(--color-accent-base) 45%, transparent)',
        border: '1px solid color-mix(in srgb, white 40%, transparent)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      } as React.CSSProperties}
      aria-label="Add transaction"
    >
      <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
    </motion.button>
  )
}
