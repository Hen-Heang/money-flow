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
    <div className="px-5 sm:px-0 grid grid-cols-1 md:grid-cols-2 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-item md:col-span-2 flex flex-col justify-between min-h-[280px] bg-gradient-to-br from-blue-600/10 via-transparent to-transparent border-blue-500/10"
      >
        <div>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3 opacity-50 tracking-[0.2em]">Monthly Balance</p>
          <h2 className={`text-6xl sm:text-8xl font-black tracking-tighter leading-none ${balance >= 0 ? 'text-[var(--color-income-base)]' : 'text-[var(--color-expense-base)]'}`}>
            <AnimatedNumber value={balance} format={fmt} />
          </h2>
        </div>

        <div className="flex items-center justify-between mt-10 border-t border-white/5 pt-5">
          <div className="min-w-0">
            <p className="text-sm font-black tracking-widest uppercase opacity-60" suppressHydrationWarning>
              {format(currentDate, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button 
              onClick={() => { haptic('light'); setCurrentDate(subMonths(currentDate, 1)) }} 
              className="p-3 rounded-xl glass-morphic border-white/5 active:scale-90 transition-all shadow-sm hover:bg-white/5" 
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => { haptic('light'); setCurrentDate(addMonths(currentDate, 1)) }} 
              disabled={isSameMonth(currentDate, new Date())} 
              className="p-3 rounded-xl glass-morphic border-white/5 active:scale-90 transition-all shadow-sm disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/5" 
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
        className="bento-item border-l-4 border-l-[var(--color-income-base)]/40 hover:border-l-[var(--color-income-base)] transition-colors"
      >
         <div className="flex items-center gap-2 mb-4 opacity-60">
           <TrendingUp size={16} className="text-[var(--color-income-base)]" />
           <span className="text-xs uppercase font-black tracking-widest">Income</span>
         </div>
         <p className="text-4xl sm:text-5xl font-black text-[var(--color-income-base)] truncate tracking-tight">
           <AnimatedNumber value={totalIncome} format={fmt} />
         </p>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bento-item border-l-4 border-l-[var(--color-expense-base)]/40 hover:border-l-[var(--color-expense-base)] transition-colors"
      >
         <div className="flex items-center gap-2 mb-4 opacity-60">
           <TrendingDown size={16} className="text-[var(--color-expense-base)]" />
           <span className="text-xs uppercase font-black tracking-widest">Expense</span>
         </div>
         <p className="text-4xl sm:text-5xl font-black text-[var(--color-expense-base)] truncate tracking-tight">
           <AnimatedNumber value={totalExpense} format={fmt} />
         </p>
      </motion.div>
    </div>
  )
})
