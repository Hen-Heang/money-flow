'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
          className="group relative overflow-hidden rounded-[28px] border p-5 shadow-lg transition-colors duration-500 sm:p-6"
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
          <div className="relative z-10 mb-5">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Daily spending guide</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)] opacity-80">
              Based on your remaining monthly budget
            </p>
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-5">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">Available per day</p>
              <p
              className="truncate font-mono text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl"
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
              <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
                {over ? 'Monthly budget exceeded' : isWarning ? 'Close to today’s limit' : 'On track'}
              </p>
            </div>
            <div className="min-w-0 border-l border-[var(--color-border-base)] pl-5 text-right">
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">Spent today</p>
              <p className="truncate font-mono text-2xl font-bold leading-none tracking-tight text-rose-400 tabular-nums sm:text-3xl">
                <AnimatedNumber value={todaySpending} format={fmt} />
              </p>
              <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">Today’s total</p>
            </div>
          </div>
          
          {/* Subtle animated gradient overlay */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
      </motion.div>
    </AnimatePresence>
  )
})
