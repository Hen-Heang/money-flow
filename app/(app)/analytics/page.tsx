'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { format, subMonths, startOfMonth } from 'date-fns'
import { Download, Flame, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useMonthNavigation } from '@/hooks/useMonthNavigation'
import { monthLabel } from '@/lib/dateHelpers'
import { useAnalyticsData } from './_hooks/useAnalyticsData'
import { useMonthSummary } from './_hooks/useMonthSummary'
import { deriveAnalytics } from './_lib/deriveAnalytics'
import { MonthlyView } from './_components/MonthlyView'
import { TrendsView } from './_components/TrendsView'
import { PERIOD_MONTHS, type Period, type View } from './_types'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('6M')
  const [view, setView] = useState<View>('trends')

  const { transactions, budgets, loading } = useAnalyticsData()

  const { year, month, isCurrentMonth, navigateMonth } = useMonthNavigation({ disableFuture: true })
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const { monthSummary, prevMonthSummary, monthLoading } = useMonthSummary(view, year, month, prevYear, prevMonth)

  const derived = React.useMemo(
    () => deriveAnalytics(transactions, budgets, PERIOD_MONTHS[period]),
    [transactions, budgets, period],
  )

  function handleExportPeriod() {
    const n = PERIOD_MONTHS[period]
    const start = startOfMonth(subMonths(new Date(), n - 1))
    const rows = transactions
      .filter(t => t.date >= format(start, 'yyyy-MM-dd'))
      .map(t => [
        t.date,
        t.type,
        t.amount_krw,
        t.categories?.name ?? '',
        t.categories?.icon ?? '',
      ])
    const csv = [
      ['Date', 'Type', 'Amount (KRW)', 'Category', 'Icon'],
      ...rows,
    ]
      .map(r => r.join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-mobile py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Analytics
        </motion.h1>

        {view === 'trends' && (
          <div className="flex items-center gap-2">
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}
            >
              {(['1M', '3M', '6M'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: period === p ? 'var(--color-accent-base)' : 'transparent',
                    color: period === p ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={handleExportPeriod}
              className="flex items-center justify-center rounded-xl p-2 transition-all active:scale-95"
              style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-secondary)' }}
              title={`Export ${period} data as CSV`}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        )}

        {view === 'monthly' && (
          <div className="flex items-center gap-1 rounded-2xl px-2 py-1.5 border" style={{ backgroundColor: 'var(--color-card-elevated-base)', borderColor: 'var(--color-border-base)' }}>
            <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-xl active:scale-90 transition-transform">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[12px] font-black tracking-tight px-1 min-w-[110px] text-center" style={{ color: 'var(--color-text-primary)' }}>
              {monthLabel(year, month)}
            </span>
            <button onClick={() => navigateMonth(1)} disabled={isCurrentMonth} className="p-1.5 rounded-xl active:scale-90 transition-transform disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className="flex rounded-2xl p-1 gap-1 mb-6" style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}>
        {([
          { key: 'trends', label: 'Trends', icon: Flame },
          { key: 'monthly', label: 'Monthly', icon: FileText },
        ] as { key: View; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all"
            style={{
              backgroundColor: view === key ? 'var(--color-accent-base)' : 'transparent',
              color: view === key ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {view === 'monthly' && (
        <MonthlyView
          monthLoading={monthLoading}
          monthSummary={monthSummary}
          prevMonthSummary={prevMonthSummary}
          year={year}
          month={month}
          prevYear={prevYear}
          prevMonth={prevMonth}
        />
      )}

      {view === 'trends' && (
        <TrendsView loading={loading} period={period} derived={derived} />
      )}
    </div>
  )
}
