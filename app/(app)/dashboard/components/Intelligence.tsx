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
    <div className="space-y-8">
      {/* AI Insights Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-7 rounded-[32px] bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent border border-blue-500/10 shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-125 transition-transform group-hover:opacity-10 pointer-events-none">
          <Sparkles size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/10">
              <Lightbulb size={16} />
            </div>
            <span className="text-xs font-black text-blue-400 tracking-[0.3em]">Command AI</span>
          </div>
          
          <p className="text-lg font-bold leading-relaxed mb-8 text-[var(--color-text-primary)] tracking-tight">
            {insights.savingsRate > 30 
              ? "Your capital efficiency is exceptional this month. Asset diversification is recommended." 
              : insights.dailyAvg > 100000 
              ? `High burn rate detected: averaging ${fmt(insights.dailyAvg)} daily. Seek optimization.` 
              : "Capital flow is stabilized. Strategic reserves are trending positively."}
          </p>

          {insights.isCurrentMonth && insights.daysRemaining > 0 && (
            <div className="space-y-4 bg-white/[0.03] p-5 rounded-2xl border border-white/5">
               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-black opacity-50 mb-1.5">Projected Exit</p>
                    <p className="text-2xl font-black tracking-tight">{fmt(insights.projectedExpense)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black opacity-50 mb-1.5">Savings Est.</p>
                    <p className={`text-xl font-black ${insights.savingsRate > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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

      {/* Quick Logging */}
      <div className="px-1">
        <h3 className="text-xs font-black opacity-40 tracking-[0.3em] mb-5 pl-1">Tactical Logging</h3>
        <div className="grid grid-cols-2 gap-4">
          {QUICK_TEMPLATES.map((t, i) => (
            <motion.button 
              key={t.name} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }} 
              onClick={() => { haptic('medium'); handleQuickAdd(t) }} 
              className="flex items-center gap-4 p-4.5 rounded-[24px] bg-[var(--color-card-elevated-base)] border border-white/5 shadow-lg hover:border-white/20 transition-all text-left group"
            >
              <span className="text-4xl shrink-0 group-hover:scale-110 transition-transform">{t.iconEmoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-black tracking-widest leading-none mb-2">{t.name}</p>
                <p className="text-base font-bold opacity-40">₩{t.amount.toLocaleString()}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
})
