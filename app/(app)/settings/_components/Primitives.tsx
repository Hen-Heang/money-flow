'use client'

import type React from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

export function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      {title && (
        <p className="px-4 mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-secondary)] opacity-60">
          {title}
        </p>
      )}
      <div className="bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-[24px] overflow-hidden shadow-sm">
        <div className="divide-y divide-[var(--color-border-base)]">
          {children}
        </div>
      </div>
    </div>
  )
}

export function Row({ icon: Icon, color, title, subtitle, right, onClick, active }: { icon: React.ElementType, color: string, title: string, subtitle?: string, right?: React.ReactNode, onClick?: () => void, active?: boolean }) {
  return (
    <motion.div
      whileTap={onClick ? { backgroundColor: 'var(--color-card-elevated-base)' } : undefined}
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${active ? 'bg-[var(--color-card-elevated-base)]' : ''}`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
        style={{ backgroundColor: color + '15' }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">{title}</p>
        {subtitle && <p className="text-[12px] font-medium text-[var(--color-text-secondary)] opacity-70">{subtitle}</p>}
      </div>
      {right ? right : onClick && <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] opacity-40" />}
    </motion.div>
  )
}
