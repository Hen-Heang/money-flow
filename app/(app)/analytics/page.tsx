'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie,
  LineChart, Line,
} from 'recharts'
import { TrendingDown, TrendingUp, Minus, Download } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { formatKRW } from '@/lib/utils'
import type { Transaction, Budget } from '@/lib/types'
import { CHART_COLORS } from '@/lib/constants'

function TrendBadge({ current, previous, invertColor = false }: { current: number; previous: number; invertColor?: boolean }) {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const isUp = pct > 0
  const isFlat = Math.abs(pct) < 0.5

  if (isFlat) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
      <Minus className="h-3 w-3" /> —
    </span>
  )

  // invertColor: for expenses, going UP is bad (red), going DOWN is good (green)
  const isGood = invertColor ? !isUp : isUp
  const color = isGood ? 'var(--color-income-base)' : 'var(--color-expense-base)'

  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color }}>
      {isUp
        ? <TrendingUp className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />
      }
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

// Analytics budget needs the extra categories join field
interface AnalyticsBudget extends Budget {
  categories?: { name: string; icon: string; color: string } | null
}

type Period = '1M' | '3M' | '6M'
const PERIOD_MONTHS: Record<Period, number> = { '1M': 1, '3M': 3, '6M': 6 }

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<AnalyticsBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('6M')
  const supabase = useSupabaseClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5))
      const now = endOfMonth(new Date())

      const [{ data: txData }, { data: budgetData }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, categories(name, icon, color)')
          .eq('user_id', user.id)
          .gte('date', format(sixMonthsAgo, 'yyyy-MM-dd'))
          .lte('date', format(now, 'yyyy-MM-dd'))
          .order('date', { ascending: true }),
        supabase
          .from('budgets')
          .select('category_id, amount_krw, categories(name, icon, color)')
          .eq('user_id', user.id)
          .gt('amount_krw', 0),
      ])

      setTransactions((txData as Transaction[]) || [])
      setBudgets((budgetData as AnalyticsBudget[]) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

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

  const n = PERIOD_MONTHS[period]

  // Period window: current period and previous period
  const periodStart   = startOfMonth(subMonths(new Date(), n - 1))
  const prevStart     = startOfMonth(subMonths(new Date(), 2 * n - 1))
  const prevEnd       = endOfMonth(subMonths(new Date(), n))

  const periodTxns    = transactions.filter(t => t.date >= format(periodStart, 'yyyy-MM-dd'))
  const prevPeriodTxns = transactions.filter(t =>
    t.date >= format(prevStart, 'yyyy-MM-dd') && t.date <= format(prevEnd, 'yyyy-MM-dd')
  )

  // Bar chart — one bar per month in selected period
  const monthlyData = Array.from({ length: n }, (_, i) => {
    const m = subMonths(new Date(), n - 1 - i)
    const monthStr = format(m, 'yyyy-MM')
    const monthTxns = transactions.filter(t => t.date.startsWith(monthStr))
    return {
      month: format(m, n === 1 ? 'MMM yyyy' : 'MMM'),
      income: monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0),
      expense: monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0),
    }
  })

  // Category breakdown — scoped to selected period
  const categoryMap: Record<string, { name: string; icon: string; color: string; total: number }> = {}
  periodTxns.filter(t => t.type === 'expense' && t.categories).forEach(t => {
    const cat = t.categories!
    if (!categoryMap[cat.name]) categoryMap[cat.name] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0 }
    categoryMap[cat.name].total += t.amount_krw
  })
  const categoryData = Object.values(categoryMap).sort((a, b) => b.total - a.total)

  // Previous-period category map for trend badges
  const prevCatMap: Record<string, number> = {}
  prevPeriodTxns.filter(t => t.type === 'expense' && t.categories).forEach(t => {
    const name = (t.categories as { name: string }).name
    prevCatMap[name] = (prevCatMap[name] || 0) + t.amount_krw
  })

  // Net flow line chart
  const netFlowData = monthlyData.map(m => ({ month: m.month, net: m.income - m.expense }))

  // Budget vs Actual (always current month)
  const thisMonthStr = format(new Date(), 'yyyy-MM')
  const thisMonthExpenses = transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'expense')
  const budgetComparison = budgets
    .map(b => {
      const cat = b.categories as { name: string; icon: string; color: string } | null
      const spent = thisMonthExpenses.filter(t => t.category_id === b.category_id).reduce((s, t) => s + t.amount_krw, 0)
      const pct = b.amount_krw > 0 ? Math.min((spent / b.amount_krw) * 100, 100) : 0
      return { cat, spent, budget: b.amount_krw, pct, over: spent > b.amount_krw }
    })
    .filter(b => b.cat)
    .sort((a, b) => b.pct - a.pct)
  const overBudgetCount = budgetComparison.filter(b => b.over).length

  // Summary stats — period-aware
  const totalIncome  = periodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense = periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const avgMonthly   = n > 0 ? totalExpense / n : 0
  const savingsRate  = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : '0'

  // Previous period totals for trend badges
  const prevIncome  = prevPeriodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const prevExpense = prevPeriodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const prevSavings = prevIncome > 0 ? (prevIncome - prevExpense) / prevIncome * 100 : 0
  const curSavings  = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome * 100 : 0

  const cardStyle = {
    backgroundColor: 'var(--color-card-base)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '16px',
  }

  return (
    <div className="px-mobile py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Analytics
        </motion.h1>

        <div className="flex items-center gap-2">
          {/* Period selector */}
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

          {/* Export CSV */}
          <button
            onClick={handleExportPeriod}
            className="flex items-center justify-center rounded-xl p-2 transition-all active:scale-95"
            style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-secondary)' }}
            title={`Export ${period} data as CSV`}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Budget vs Actual — current month */}
      {budgetComparison.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Budget vs Actual
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {format(new Date(), 'MMMM')}
              </span>
              {overBudgetCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-expense-base)' }}
                >
                  {overBudgetCount} over
                </span>
              )}
              {overBudgetCount === 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: 'var(--color-income-base)' }}
                >
                  On track
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {budgetComparison.map(({ cat, spent, budget, pct, over }) => {
              const barColor = over
                ? 'var(--color-expense-base)'
                : pct >= 80
                  ? 'var(--color-warning-base)'
                  : 'var(--color-income-base)'

              return (
                <div key={cat!.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {cat!.icon} {cat!.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: over ? 'var(--color-expense-base)' : 'var(--color-text-secondary)' }}>
                        {formatKRW(spent)}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>/</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{formatKRW(budget)}</span>
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: barColor }}>{pct.toFixed(0)}% used</span>
                    {over
                      ? <span style={{ color: 'var(--color-expense-base)' }}>+{formatKRW(spent - budget)} over</span>
                      : <span>{formatKRW(budget - spent)} left</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          {
            label: `${period} Income`, value: formatKRW(totalIncome), color: 'var(--color-income-base)',
            trend: <TrendBadge current={totalIncome} previous={prevIncome} />,
          },
          {
            label: `${period} Expense`, value: formatKRW(totalExpense), color: 'var(--color-expense-base)',
            trend: <TrendBadge current={totalExpense} previous={prevExpense} invertColor />,
          },
          {
            label: 'Avg / Month', value: formatKRW(avgMonthly), color: 'var(--color-accent-base)',
            trend: null,
          },
          {
            label: 'Savings Rate', value: `${savingsRate}%`, color: 'var(--color-warning-base)',
            trend: <TrendBadge current={curSavings} previous={prevSavings} />,
          },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ backgroundColor: 'var(--color-card-base)', borderRadius: '16px', padding: '16px' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</p>
              {stat.trend}
            </div>
            <p className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Monthly Income vs Expense */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Income vs Expense · {period}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-card-elevated-base)',
                border: '1px solid var(--color-border-base)',
                borderRadius: '12px',
                color: 'var(--color-text-primary)',
              }}
              formatter={(value) => [formatKRW(Number(value))]}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} />
            <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
            <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Net Flow */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Net Cash Flow</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={netFlowData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-card-elevated-base)',
                border: '1px solid var(--color-border-base)',
                borderRadius: '12px',
                color: 'var(--color-text-primary)',
              }}
              formatter={(value) => [formatKRW(Number(value)), 'Net']}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Expense by Category · {period}
          </h3>
          <div className="flex gap-4 items-center mb-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={categoryData.map((entry, i) => ({ ...entry, fill: entry.color || CHART_COLORS[i % CHART_COLORS.length] }))} dataKey="total" cx="50%" cy="50%" innerRadius={30} outerRadius={55} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {categoryData.slice(0, 5).map((cat, index) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatKRW(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar list */}
          <div className="space-y-3">
            {categoryData.map((cat, index) => {
              const max = categoryData[0].total
              const curCat = categoryMap[cat.name]?.total || 0
              const prevCat = prevCatMap[cat.name] || 0
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <TrendBadge current={curCat} previous={prevCat} invertColor />
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {formatKRW(cat.total)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.total / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: index * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-income-base)', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </div>
  )
}
