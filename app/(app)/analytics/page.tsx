'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie,
  LineChart, Line,
} from 'recharts'
import { TrendingDown, TrendingUp, Minus, Download, Flame, CalendarClock, ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { formatKRW } from '@/lib/utils'
import { useMonthNavigation } from '@/hooks/useMonthNavigation'
import { monthLabel, monthKey, getMonthRange } from '@/lib/dateHelpers'
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

interface MonthSummary {
  income: number
  expense: number
  txCount: number
  topCategories: { name: string; icon: string; color: string; total: number }[]
}

function delta(current: number, prev: number) {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

function TrendPill({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null
  const isUp = pct > 0
  const isFlat = Math.abs(pct) < 0.5
  if (isFlat) return (
    <span className="flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
      <Minus size={9} /> Flat
    </span>
  )
  const isGood = invert ? !isUp : isUp
  const color = isGood ? '#22c55e' : '#ef4444'
  const bg = isGood ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>
      {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

type View = 'trends' | 'monthly'

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<AnalyticsBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('6M')
  const [view, setView] = useState<View>('trends')
  const supabase = useSupabaseClient()

  // Monthly summary state
  const { year, month, isCurrentMonth, navigateMonth } = useMonthNavigation({ disableFuture: true })
  const monthCacheRef = useMemo(() => new Map<string, MonthSummary>(), [])
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null)
  const [prevMonthSummary, setPrevMonthSummary] = useState<MonthSummary | null>(null)
  const [monthLoading, setMonthLoading] = useState(false)

  const prevYear  = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1

  const fetchMonthSummary = useCallback(async (y: number, m: number, userId: string): Promise<MonthSummary | null> => {
    const key = monthKey(y, m)
    if (monthCacheRef.has(key)) return monthCacheRef.get(key)!
    const { start, end } = getMonthRange(y, m)
    const { data } = await supabase
      .from('transactions')
      .select('type, amount_krw, categories(name, icon, color)')
      .eq('user_id', userId)
      .gte('date', start)
      .lt('date', end)
    if (!data) return null
    const rows = data as { type: string; amount_krw: number; categories: { name: string; icon: string; color: string } | null }[]
    const income  = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const expense = rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
    const catMap: Record<string, { name: string; icon: string; color: string; total: number }> = {}
    rows.filter(t => t.type === 'expense' && t.categories).forEach(t => {
      const c = t.categories!
      if (!catMap[c.name]) catMap[c.name] = { ...c, total: 0 }
      catMap[c.name].total += t.amount_krw
    })
    const result: MonthSummary = {
      income, expense, txCount: rows.length,
      topCategories: Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 6),
    }
    monthCacheRef.set(key, result)
    return result
  }, [supabase, monthCacheRef])

  useEffect(() => {
    if (view !== 'monthly') return
    setMonthLoading(true)
    let cancelled = false
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId || cancelled) return
      const [cur, prev] = await Promise.all([
        fetchMonthSummary(year, month, userId),
        fetchMonthSummary(prevYear, prevMonth, userId),
      ])
      if (cancelled) return
      setMonthSummary(cur)
      setPrevMonthSummary(prev)
      setMonthLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [view, year, month, prevYear, prevMonth, fetchMonthSummary, supabase])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5))
      const now = endOfMonth(new Date())

      const [{ data: txData }, { data: budgetData }] = await Promise.all([
        supabase
          .from('transactions')
          .select('date, type, amount_krw, category_id, categories(name, icon, color), payment_methods(name, icon)')
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
    } catch {
    } finally {
      setLoading(false)
    }
  }, [supabase])

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

  const derived = useMemo(() => {
    const now = new Date()
    const periodStart  = startOfMonth(subMonths(now, n - 1))
    const prevStart    = startOfMonth(subMonths(now, 2 * n - 1))
    const prevEnd      = endOfMonth(subMonths(now, n))
    const periodStartStr = format(periodStart, 'yyyy-MM-dd')
    const prevStartStr   = format(prevStart, 'yyyy-MM-dd')
    const prevEndStr     = format(prevEnd, 'yyyy-MM-dd')

    const periodTxns     = transactions.filter(t => t.date >= periodStartStr)
    const prevPeriodTxns = transactions.filter(t => t.date >= prevStartStr && t.date <= prevEndStr)

    // Bar chart — group by month in a single pass
    const monthMap = new Map<string, { income: number; expense: number; label: string }>()
    for (let i = 0; i < n; i++) {
      const m = subMonths(now, n - 1 - i)
      monthMap.set(format(m, 'yyyy-MM'), { income: 0, expense: 0, label: format(m, n === 1 ? 'MMM yyyy' : 'MMM') })
    }
    transactions.forEach(t => {
      const key = t.date.slice(0, 7)
      const entry = monthMap.get(key)
      if (!entry) return
      if (t.type === 'income') entry.income += t.amount_krw
      else entry.expense += t.amount_krw
    })
    const monthlyData = Array.from(monthMap.values()).map(({ label, income, expense }) => ({ month: label, income, expense }))
    const netFlowData = monthlyData.map(m => ({ month: m.month, net: m.income - m.expense }))

    // Category breakdown
    const categoryMap: Record<string, { name: string; icon: string; color: string; total: number }> = {}
    periodTxns.filter(t => t.type === 'expense' && t.categories).forEach(t => {
      const cat = t.categories!
      if (!categoryMap[cat.name]) categoryMap[cat.name] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0 }
      categoryMap[cat.name].total += t.amount_krw
    })
    const categoryData = Object.values(categoryMap).sort((a, b) => b.total - a.total)

    const prevCatMap: Record<string, number> = {}
    prevPeriodTxns.filter(t => t.type === 'expense' && t.categories).forEach(t => {
      const name = (t.categories as { name: string }).name
      prevCatMap[name] = (prevCatMap[name] || 0) + t.amount_krw
    })

    // Budget vs Actual
    const thisMonthStr = format(now, 'yyyy-MM')
    const thisMonthExpenseMap = new Map<string, number>()
    transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'expense' && t.category_id).forEach(t => {
      thisMonthExpenseMap.set(t.category_id!, (thisMonthExpenseMap.get(t.category_id!) ?? 0) + t.amount_krw)
    })
    const budgetComparison = budgets
      .map(b => {
        const cat = b.categories as { name: string; icon: string; color: string } | null
        const spent = thisMonthExpenseMap.get(b.category_id) ?? 0
        const pct = b.amount_krw > 0 ? Math.min((spent / b.amount_krw) * 100, 100) : 0
        return { cat, spent, budget: b.amount_krw, pct, over: spent > b.amount_krw }
      })
      .filter(b => b.cat)
      .sort((a, b) => b.pct - a.pct)
    const overBudgetCount = budgetComparison.filter(b => b.over).length

    // Summary stats
    const totalIncome  = periodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const totalExpense = periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
    const avgMonthly   = n > 0 ? totalExpense / n : 0
    const savingsRate  = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : '0'
    const prevIncome   = prevPeriodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const prevExpense  = prevPeriodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
    const prevSavings  = prevIncome > 0 ? (prevIncome - prevExpense) / prevIncome * 100 : 0
    const curSavings   = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome * 100 : 0

    // Payment method breakdown
    const pmMap: Record<string, { name: string; icon: string; total: number }> = {}
    periodTxns.filter(t => t.type === 'expense').forEach(t => {
      const pm = t.payment_methods
      const key = pm ? pm.name : 'Other'
      const icon = pm ? pm.icon : '💳'
      if (!pmMap[key]) pmMap[key] = { name: key, icon, total: 0 }
      pmMap[key].total += t.amount_krw
    })
    const paymentMethodData = Object.values(pmMap).sort((a, b) => b.total - a.total)

    // Forecast — current month only
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - dayOfMonth
    const thisMonthSpend  = transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
    const thisMonthIncome = transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const dailyRate = dayOfMonth > 0 ? thisMonthSpend / dayOfMonth : 0
    const projectedSpend = dailyRate * daysInMonth
    const totalBudgetKrw = budgets.reduce((s, b) => s + b.amount_krw, 0)
    const projectedVsBudget = totalBudgetKrw > 0 ? projectedSpend - totalBudgetKrw : null
    // Per-category budget projections
    const categoryForecast = budgets
      .map(b => {
        const cat = b.categories as { name: string; icon: string; color: string } | null
        if (!cat) return null
        const spentSoFar = thisMonthExpenseMap.get(b.category_id) ?? 0
        const catDailyRate = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0
        const catProjected = catDailyRate * daysInMonth
        const pct = b.amount_krw > 0 ? (catProjected / b.amount_krw) * 100 : 0
        return { cat, projected: catProjected, budget: b.amount_krw, pct, over: catProjected > b.amount_krw }
      })
      .filter(Boolean)
      .sort((a, b) => b!.pct - a!.pct) as { cat: { name: string; icon: string; color: string }; projected: number; budget: number; pct: number; over: boolean }[]

    return { monthlyData, netFlowData, categoryData, categoryMap, prevCatMap, budgetComparison, overBudgetCount, totalIncome, totalExpense, avgMonthly, savingsRate, prevIncome, prevExpense, prevSavings, curSavings, paymentMethodData, forecast: { dayOfMonth, daysInMonth, daysRemaining, dailyRate, projectedSpend, thisMonthSpend, thisMonthIncome, projectedVsBudget, totalBudgetKrw, categoryForecast } }
  }, [transactions, budgets, period, n])

  const { monthlyData, netFlowData, categoryData, categoryMap, prevCatMap, budgetComparison, overBudgetCount, totalIncome, totalExpense, avgMonthly, savingsRate, prevIncome, prevExpense, prevSavings, curSavings, paymentMethodData, forecast } = derived

  const cardStyle = {
    backgroundColor: 'var(--color-card-base)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '16px',
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
          { key: 'trends',  label: 'Trends',  icon: Flame },
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

      {/* ── Monthly Summary View ── */}
      {view === 'monthly' && (
        <div className="space-y-4">
          {monthLoading ? (
            [1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-[24px]" />)
          ) : monthSummary ? (() => {
            const balance = monthSummary.income - monthSummary.expense
            const savingsRate = monthSummary.income > 0 ? ((monthSummary.income - monthSummary.expense) / monthSummary.income) * 100 : 0
            const prevBalance = prevMonthSummary ? prevMonthSummary.income - prevMonthSummary.expense : 0
            const prevSavings = prevMonthSummary && prevMonthSummary.income > 0 ? ((prevMonthSummary.income - prevMonthSummary.expense) / prevMonthSummary.income) * 100 : 0
            return (
              <>
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
                    { label: 'Income',       value: formatKRW(monthSummary.income),          color: '#22c55e', pct: delta(monthSummary.income, prevMonthSummary?.income ?? 0),   invert: false },
                    { label: 'Expense',      value: formatKRW(monthSummary.expense),         color: '#ef4444', pct: delta(monthSummary.expense, prevMonthSummary?.expense ?? 0), invert: true },
                    { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`,            color: '#3b82f6', pct: savingsRate - prevSavings || null,                            invert: false },
                    { label: 'Transactions', value: `${monthSummary.txCount}`,               color: 'var(--color-text-primary)', pct: null,                                      invert: false },
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
                        { label: 'Income',  cur: monthSummary.income,  prev: prevMonthSummary.income,  good: true },
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
              </>
            )
          })() : null}
        </div>
      )}

      {/* ── Trends View ── */}
      {view === 'trends' && <>

      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-40 rounded-[20px]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-20 rounded-[16px]" />
            <div className="skeleton h-20 rounded-[16px]" />
            <div className="skeleton h-20 rounded-[16px]" />
            <div className="skeleton h-20 rounded-[16px]" />
          </div>
          <div className="skeleton h-56 rounded-[20px]" />
          <div className="skeleton h-44 rounded-[20px]" />
        </div>
      )}

      {/* Forecast card — current month projection */}
      {!loading && forecast.dayOfMonth > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 overflow-hidden rounded-[20px] border border-white/10 p-5"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.06) 100%)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-[13px] font-black uppercase tracking-widest text-blue-400">
                {format(new Date(), 'MMMM')} Forecast
              </p>
            </div>
            <span className="text-[11px] font-bold opacity-40">
              Day {forecast.dayOfMonth} of {forecast.daysInMonth} · {forecast.daysRemaining}d left
            </span>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Spent',      value: formatKRW(forecast.thisMonthSpend),              color: 'var(--color-text-primary)' },
              { label: 'Projected',  value: formatKRW(Math.round(forecast.projectedSpend)),  color: forecast.projectedVsBudget !== null && forecast.projectedVsBudget > 0 ? '#ef4444' : '#22c55e' },
              { label: 'Daily',      value: formatKRW(Math.round(forecast.dailyRate)),        color: 'var(--color-text-primary)' },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40 mb-1">{m.label}</p>
                <p className="text-[12px] font-black leading-tight break-all" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Budget impact */}
          {forecast.projectedVsBudget !== null && (
            <div
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5 mb-4"
              style={{
                backgroundColor: forecast.projectedVsBudget > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${forecast.projectedVsBudget > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
              }}
            >
              {forecast.projectedVsBudget > 0
                ? <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                : <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
              }
              <p className="text-[12px] font-bold" style={{ color: forecast.projectedVsBudget > 0 ? '#f87171' : '#4ade80' }}>
                {forecast.projectedVsBudget > 0
                  ? `Projected to exceed total budget by ${formatKRW(Math.round(forecast.projectedVsBudget))}`
                  : `On track — ${formatKRW(Math.round(Math.abs(forecast.projectedVsBudget)))} under budget`
                }
              </p>
            </div>
          )}

          {/* Per-category projections */}
          {forecast.categoryForecast.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mb-2">Category Outlook</p>
              {forecast.categoryForecast.map(({ cat, projected, budget, pct, over }) => {
                const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {cat.icon} {cat.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black" style={{ color: barColor }}>
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-[10px] opacity-40 font-medium">
                          {formatKRW(Math.round(projected))} / {formatKRW(budget)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}50` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

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

      {/* Payment Method Breakdown */}
      {paymentMethodData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Expense by Payment Method · {period}
          </h3>
          <div className="flex gap-4 items-center mb-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={paymentMethodData.map((entry, i) => ({ ...entry, fill: CHART_COLORS[i % CHART_COLORS.length] }))}
                  dataKey="total"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {paymentMethodData.slice(0, 5).map((pm, i) => (
                <div key={pm.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {pm.icon} {pm.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatKRW(pm.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {paymentMethodData.map((pm, i) => {
              const max = paymentMethodData[0].total
              return (
                <div key={pm.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {pm.icon} {pm.name}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {formatKRW(pm.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(pm.total / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      </>}

    </div>
  )
}
