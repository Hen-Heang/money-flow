'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isSameMonth } from 'date-fns'
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
          <div className="rounded-[32px] border p-6 flex items-center gap-5 bg-indigo-500/10 border-indigo-500/25 shadow-2xl relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
               <span className="text-6xl">📅</span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-3xl shrink-0 border border-indigo-500/10">
              📅
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-base font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                Review {format(new Date(), 'MMMM')} Capital Plan
              </p>
              <p className="text-xs mt-1 opacity-50 font-medium">Strategic check-in is recommended for this cycle.</p>
            </div>
            <div className="flex items-center gap-4 shrink-0 relative z-10">
              <button 
                onClick={() => { haptic('medium'); router.push('/settings') }} 
                className="px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-indigo-500 hover:bg-indigo-600 transition-all shadow-xl active:scale-95 tracking-widest uppercase"
              >
                Review
              </button>
              <button 
                onClick={() => { haptic('light'); onDismiss() }} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors opacity-40 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
