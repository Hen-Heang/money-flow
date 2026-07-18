'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface BudgetReviewPromptProps {
  show: boolean
  onDismiss: () => void
}

export const BudgetReviewPrompt = memo(function BudgetReviewPrompt({ 
  show, 
  onDismiss 
}: BudgetReviewPromptProps) {
  const router = useRouter()
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 10 }} 
          className="px-5 sm:px-0"
        >
          <div className="group relative flex items-start gap-4 overflow-hidden rounded-[28px] border border-indigo-500/25 bg-indigo-500/10 p-5 shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
               <span className="text-6xl">📅</span>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/10 bg-indigo-500/20 text-2xl">
              📅
            </div>
            <div className="relative z-10 min-w-0 flex-1 pr-7">
              <p className="text-base font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                Review your {format(new Date(), 'MMMM')} budget
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">A quick check now can prevent surprises later in the month.</p>
              <button 
                type="button"
                onClick={() => { haptic('medium'); router.push('/settings') }} 
                className="mt-4 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-[background-color,transform] hover:bg-indigo-600 active:scale-95"
              >
                Review budget
              </button>
            </div>
            <button
              type="button"
              onClick={() => { haptic('light'); onDismiss() }}
              aria-label="Dismiss budget review reminder"
              className="absolute right-3 top-3 z-20 rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--color-text-primary)]"
            >
              <X size={17} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
