'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import type { Transaction } from '@/lib/types'
import { haptic } from '@/lib/utils'

interface RecentActivityProps {
  transactions: Transaction[]
  fmt: (amount: number) => string
  limit?: number
}

export const RecentActivity = memo(function RecentActivity({ 
  transactions, 
  fmt, 
  limit = 5 
}: RecentActivityProps) {
  const router = useRouter()
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium overflow-hidden border-[var(--color-border-base)] bg-[var(--color-card-base)] shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border-base)] p-5">
        <h3 className="text-base font-semibold">Recent activity</h3>
        <button 
          type="button"
          onClick={() => { haptic('light'); router.push('/transactions') }} 
          className="rounded-xl border border-blue-500/15 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 transition-[background-color,transform] hover:bg-blue-500/20 active:scale-95"
        >
          View all
        </button>
      </div>
      <div className="divide-y divide-[var(--color-border-base)]">
        {transactions.slice(0, limit).map((t, i) => (
          <motion.button
            type="button"
            key={t.id} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { haptic('light'); router.push('/transactions') }} 
            className="group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] sm:gap-4 sm:p-5"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-inner transition-transform group-hover:scale-105 ${
              t.type === 'income' 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' 
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'
            }`}>
              {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-base">{t.description}</p>
              <p className="mt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                {format(new Date(t.date), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-mono text-sm font-bold tracking-tight tabular-nums sm:text-base ${
                t.type === 'income' ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'
              }`}>
                {t.type === 'income' ? '+' : ''}{fmt(t.amount_krw)}
              </p>
              {t.type === 'expense' && (
                <p className="mt-0.5 max-w-24 truncate text-xs font-medium text-[var(--color-text-secondary)]">
                   {t.categories?.name || 'Uncategorized'}
                </p>
              )}
            </div>
          </motion.button>
        ))}
      </div>
      {transactions.length === 0 && (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No transactions yet. Add one to start your monthly overview.</p>
        </div>
      )}
    </motion.div>
  )
})
