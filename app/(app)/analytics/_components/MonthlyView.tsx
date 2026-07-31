'use client'

import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { monthLabel } from '@/lib/dateHelpers'
import { delta } from '../_lib/deriveAnalytics'
import { TrendPill } from './TrendIndicators'
import type { MonthSummary } from '../_types'

export function MonthlyView({
  monthLoading,
  monthSummary,
  prevMonthSummary,
  year,
  month,
  prevYear,
  prevMonth,
}: {
  monthLoading: boolean
  monthSummary: MonthSummary | null
  prevMonthSummary: MonthSummary | null
  year: number
  month: number
  prevYear: number
  prevMonth: number
}) {
  if (monthLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-[24px]" />)}
      </div>
    )
  }

  if (!monthSummary) return null

  const balance = monthSummary.income - monthSummary.expense
  const savingsRate = monthSummary.income > 0 ? ((monthSummary.income - monthSummary.expense) / monthSummary.income) * 100 : 0
  const prevBalance = prevMonthSummary ? prevMonthSummary.income - prevMonthSummary.expense : 0
  const prevSavings = prevMonthSummary && prevMonthSummary.income > 0 ? ((prevMonthSummary.income - prevMonthSummary.expense) / prevMonthSummary.income) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Hero balance card */}
      <div
        className="relative overflow-hidden rounded-[32px] border border-white/10 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.06) 100%)', backdropFilter: 'blur(20px)' }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">Net Balance</p>
        <p className="text-[clamp(1.75rem,8vw,4rem)] font-black leading-none tracking-tighter mb-2 break-all"
          style={{ color: balance >= 0 ? '#22c55e' : '#ef4444' }}>
          {balance >= 0 ? '' : '-'}{formatKRW(Math.abs(balance))}
        </p>
        <div className="flex items-center gap-2">
          <TrendPill pct={delta(balance, prevBalance)} />
          <span className="text-[11px] font-bold opacity-40">vs {monthLabel(prevYear, prevMonth)}</span>
        </div>
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Income', value: formatKRW(monthSummary.income), color: '#22c55e', pct: delta(monthSummary.income, prevMonthSummary?.income ?? 0), invert: false },
          { label: 'Expense', value: formatKRW(monthSummary.expense), color: '#ef4444', pct: delta(monthSummary.expense, prevMonthSummary?.expense ?? 0), invert: true },
          { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`, color: '#3b82f6', pct: savingsRate - prevSavings || null, invert: false },
          { label: 'Transactions', value: `${monthSummary.txCount}`, color: 'var(--color-text-primary)', pct: null, invert: false },
        ].map(stat => (
          <div key={stat.label} className="rounded-[20px] p-4 border border-[var(--color-border-base)]" style={{ backgroundColor: 'var(--color-card-base)' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">{stat.label}</p>
            <p className="text-[15px] sm:text-[18px] font-black leading-tight mb-1 break-all" style={{ color: stat.color }}>{stat.value}</p>
            <TrendPill pct={stat.pct ?? null} invert={stat.invert} />
          </div>
        ))}
      </div>

      {/* Top categories */}
      {monthSummary.topCategories.length > 0 && (
        <div className="rounded-[24px] border border-[var(--color-border-base)] overflow-hidden" style={{ backgroundColor: 'var(--color-card-base)' }}>
          <div className="px-5 pt-5 pb-3">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Top Spending</p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {monthSummary.topCategories.map((cat, i) => {
              const max = monthSummary.topCategories[0].total
              const prevCat = prevMonthSummary?.topCategories.find(c => c.name === cat.name)
              return (
                <motion.div key={cat.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{cat.icon} {cat.name}</span>
                    <div className="flex items-center gap-2">
                      <TrendPill pct={delta(cat.total, prevCat?.total ?? 0)} invert />
                      <span className="text-[13px] font-black" style={{ color: 'var(--color-text-primary)' }}>{formatKRW(cat.total)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.total / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
                      style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}50` }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* MoM comparison */}
      {prevMonthSummary && (prevMonthSummary.income > 0 || prevMonthSummary.expense > 0) && (
        <div className="rounded-[24px] border border-[var(--color-border-base)] p-5" style={{ backgroundColor: 'var(--color-card-base)' }}>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">vs {monthLabel(prevYear, prevMonth)}</p>
          <div className="space-y-3">
            {[
              { label: 'Income', cur: monthSummary.income, prev: prevMonthSummary.income, good: true },
              { label: 'Expense', cur: monthSummary.expense, prev: prevMonthSummary.expense, good: false },
            ].map(row => {
              const diff = row.cur - row.prev
              const isMore = diff > 0
              const color = (row.good ? isMore : !isMore) ? '#22c55e' : '#ef4444'
              return (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[13px] font-bold opacity-60">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black" style={{ color }}>{diff >= 0 ? '+' : ''}{formatKRW(diff)}</span>
                    <span className="text-[11px] opacity-30 font-medium">from {formatKRW(row.prev)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {monthSummary.income === 0 && monthSummary.expense === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-[32px] border border-dashed border-[var(--color-border-base)]" style={{ backgroundColor: 'var(--color-card-base)' }}>
          <div className="w-20 h-20 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center mb-6">
            <FileText className="w-9 h-9 opacity-30" />
          </div>
          <h3 className="text-xl font-black mb-2">No data for this month</h3>
          <p className="text-sm font-medium opacity-50 max-w-[220px] leading-relaxed">No transactions recorded in {monthLabel(year, month)}.</p>
        </div>
      )}
    </div>
  )
}
