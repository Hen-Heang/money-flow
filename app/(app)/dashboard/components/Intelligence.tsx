'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, Sparkles } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { QUICK_TEMPLATES } from '@/shared/data'

interface IntelligenceProps {
  insights: {
    dailyAvg: number
    savingsRate: number
    projectedExpense: number
    daysRemaining: number
    isCurrentMonth: boolean
  }
  totalIncome: number
  fmt: (amount: number) => string
  handleQuickAdd: (template: typeof QUICK_TEMPLATES[0]) => void
}

export const Intelligence = memo(function Intelligence({ 
  insights, 
  totalIncome, 
  fmt, 
  handleQuickAdd 
}: IntelligenceProps) {
  return (
    <div className="space-y-7">
      {/* Monthly insight */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative overflow-hidden rounded-[28px] border border-blue-500/15 bg-gradient-to-br from-blue-600/16 via-indigo-600/8 to-transparent p-6 shadow-lg"
      >
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-125 transition-transform group-hover:opacity-10 pointer-events-none">
          <Sparkles size={80} />
        </div>
        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/10">
              <Lightbulb size={16} />
            </div>
            <span className="text-sm font-semibold text-blue-400">Monthly insight</span>
          </div>
          
          <p className="mb-6 text-base font-semibold leading-relaxed text-[var(--color-text-primary)]">
            {insights.savingsRate > 30 
              ? "You’re keeping more than 30% of your income this month. That gives you strong room for savings goals."
              : insights.dailyAvg > 100000 
              ? `You’re spending about ${fmt(insights.dailyAvg)} per day. Review your largest categories before the month ends.`
              : "Your daily spending is steady. Keep logging transactions to make the forecast more accurate."}
          </p>

          {insights.isCurrentMonth && insights.daysRemaining > 0 && (
            <div className="space-y-4 rounded-2xl border border-[var(--color-border-base)] bg-white/[0.03] p-4">
               <div className="flex justify-between items-end">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">Projected spending</p>
                    <p className="font-mono text-xl font-bold tracking-tight tabular-nums">{fmt(insights.projectedExpense)}</p>
                  </div>
                  <div className="text-right">
                    <p className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">Savings rate</p>
                    <p className={`font-mono text-lg font-bold tabular-nums ${insights.savingsRate > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {insights.savingsRate.toFixed(1)}%
                    </p>
                  </div>
               </div>
               <div className="h-2 rounded-full bg-white/5 overflow-hidden p-[1px]">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${Math.min((insights.projectedExpense / (totalIncome || 1)) * 100, 100)}%` }} 
                    className="h-full bg-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,0.6)]" 
                  />
               </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick add */}
      <div className="px-1">
        <h3 className="mb-3 pl-1 text-sm font-semibold text-[var(--color-text-secondary)]">Quick add</h3>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_TEMPLATES.map((t, i) => (
            <motion.button 
              key={t.name} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }} 
              onClick={() => { haptic('medium'); handleQuickAdd(t) }} 
              className="group flex min-w-0 items-center gap-3 rounded-[20px] border border-[var(--color-border-base)] bg-[var(--color-card-base)] p-3.5 text-left shadow-sm transition-[border-color,transform] hover:border-blue-500/30"
            >
              <span className="shrink-0 text-2xl transition-transform group-hover:scale-105">{t.iconEmoji}</span>
              <div className="min-w-0">
                <p className="mb-1 truncate text-sm font-semibold leading-none">{t.name}</p>
                <p className="font-mono text-xs font-medium text-[var(--color-text-secondary)] tabular-nums">₩{t.amount.toLocaleString()}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
})
