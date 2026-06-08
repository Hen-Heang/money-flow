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
      className="card-premium shadow-2xl overflow-hidden border-white/5 bg-white/[0.01]"
    >
      <div className="p-6 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
        <h3 className="text-base font-black opacity-60 tracking-[0.2em]">Recent Activity</h3>
        <button 
          onClick={() => { haptic('light'); router.push('/transactions') }} 
          className="text-tiny font-black text-blue-400 tracking-widest px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-all active:scale-95 border border-blue-500/10"
        >
          ALL
        </button>
      </div>
      <div className="divide-y divide-white/5">
        {transactions.slice(0, limit).map((t, i) => (
          <motion.div 
            key={t.id} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => { haptic('light'); router.push('/transactions') }} 
            className="p-6 flex items-center gap-5 hover:bg-white/[0.03] transition-all cursor-pointer active:bg-white/[0.05] group"
          >
            <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-3xl shadow-inner transition-transform group-hover:scale-110 shrink-0 ${
              t.type === 'income' 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' 
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'
            }`}>
              {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate tracking-tight text-white/90">{t.description}</p>
              <p className="text-sm text-[var(--color-text-secondary)] font-bold opacity-50 mt-1">
                {format(new Date(t.date), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-2xl tracking-tighter ${
                t.type === 'income' ? 'text-emerald-400' : 'text-white'
              }`}>
                {t.type === 'income' ? '+' : ''}{fmt(t.amount_krw)}
              </p>
              {t.type === 'expense' && (
                <p className="text-sm font-bold opacity-40 mt-0.5 uppercase tracking-tighter">
                   {t.categories?.name || 'Uncategorized'}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      {transactions.length === 0 && (
        <div className="p-10 text-center opacity-30">
          <p className="text-sm font-bold">No transactions logged yet.</p>
        </div>
      )}
    </motion.div>
  )
})
