'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

interface DailyBudgetPillProps {
  dailyBudgetRemaining: {
    perDay: number
    todaySpending: number
    todayAllowance: number
    over: boolean
  } | null
  loading: boolean
  fmt: (amount: number) => string
}

export const DailyBudgetPill = memo(function DailyBudgetPill({ 
  dailyBudgetRemaining, 
  loading, 
  fmt 
}: DailyBudgetPillProps) {
  if (!dailyBudgetRemaining || loading) return null

  const { perDay, todaySpending, todayAllowance, over } = dailyBudgetRemaining
  const isWarning = !over && perDay < todayAllowance * 0.3

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="px-5 sm:px-0"
      >
        <div
          className="flex items-center justify-between p-7 rounded-[28px] border shadow-xl relative overflow-hidden group transition-colors duration-500"
          style={{
            backgroundColor: over
              ? 'rgba(239,68,68,0.12)'
              : isWarning
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(16,185,129,0.12)',
            borderColor: over
              ? 'rgba(239,68,68,0.25)'
              : isWarning
              ? 'rgba(245,158,11,0.25)'
              : 'rgba(16,185,129,0.25)',
          }}
        >
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.25em] opacity-40 mb-2">Strategic Reserve</p>
            <p
              className="text-4xl font-black tracking-tighter leading-none"
              style={{
                color: over
                  ? 'var(--color-expense-base)'
                  : isWarning
                  ? 'var(--color-warning-base)'
                  : 'var(--color-income-base)',
              }}
            >
              {over && '−'}<AnimatedNumber value={Math.abs(perDay)} format={fmt} />
            </p>
            <p className="text-xs font-bold mt-2 opacity-50 tracking-tight">
              {over ? 'CRITICAL: REDUCE SPENDING' : `AVAILABLE PER DAY`}
            </p>
          </div>
          <div className="text-right relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.25em] opacity-40 mb-2">Tactical Deployment</p>
            <p className="text-3xl font-black tracking-tighter leading-none text-rose-400">
              <AnimatedNumber value={todaySpending} format={fmt} />
            </p>
            <p className="text-xs font-bold mt-2 opacity-50 tracking-tight">SPENT TODAY</p>
          </div>
          
          {/* Subtle animated gradient overlay */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
      </motion.div>
    </AnimatePresence>
  )
})
