'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, subMonths, addMonths, isSameMonth } from 'date-fns'
import { haptic } from '@/lib/utils'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

interface SummaryCardsProps {
  balance: number
  totalIncome: number
  totalExpense: number
  currentDate: Date
  setCurrentDate: (date: Date) => void
  fmt: (amount: number) => string
}

export const SummaryCards = memo(function SummaryCards({
  balance,
  totalIncome,
  totalExpense,
  currentDate,
  setCurrentDate,
  fmt
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 sm:gap-4 sm:px-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-item col-span-2 flex min-h-[230px] flex-col justify-between border-blue-500/15 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent sm:min-h-[260px]"
      >
        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">Balance this month</p>
          <h2 className={`font-mono text-3xl font-bold leading-none tracking-tight tabular-nums xs:text-4xl sm:text-5xl ${balance >= 0 ? 'text-[var(--color-income-base)]' : 'text-[var(--color-expense-base)]'}`}>
            <AnimatedNumber value={balance} format={fmt} />
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Income minus expenses</p>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[var(--color-border-base)] pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] sm:text-base" suppressHydrationWarning>
              {format(currentDate, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button 
              onClick={() => { haptic('light'); setCurrentDate(subMonths(currentDate, 1)) }} 
              className="glass-morphic rounded-xl border border-[var(--color-border-base)] p-3 shadow-sm transition-transform hover:bg-white/5 active:scale-90"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => { haptic('light'); setCurrentDate(addMonths(currentDate, 1)) }} 
              disabled={isSameMonth(currentDate, new Date())} 
              className="glass-morphic rounded-xl border border-[var(--color-border-base)] p-3 shadow-sm transition-transform hover:bg-white/5 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bento-item min-w-0 border-t-2 border-t-[var(--color-income-base)]/50 transition-colors hover:border-t-[var(--color-income-base)]"
      >
         <div className="mb-3 flex items-center gap-2 text-[var(--color-text-secondary)]">
           <TrendingUp size={16} className="text-[var(--color-income-base)]" />
           <span className="text-xs font-semibold sm:text-sm">Income</span>
         </div>
         <p className="truncate font-mono text-xl font-bold tracking-tight text-[var(--color-income-base)] tabular-nums sm:text-3xl">
           <AnimatedNumber value={totalIncome} format={fmt} />
         </p>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bento-item min-w-0 border-t-2 border-t-[var(--color-expense-base)]/50 transition-colors hover:border-t-[var(--color-expense-base)]"
      >
         <div className="mb-3 flex items-center gap-2 text-[var(--color-text-secondary)]">
           <TrendingDown size={16} className="text-[var(--color-expense-base)]" />
           <span className="text-xs font-semibold sm:text-sm">Expenses</span>
         </div>
         <p className="truncate font-mono text-xl font-bold tracking-tight text-[var(--color-expense-base)] tabular-nums sm:text-3xl">
           <AnimatedNumber value={totalExpense} format={fmt} />
         </p>
      </motion.div>
    </div>
  )
})
