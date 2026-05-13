'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { useMonthNavigation } from '@/hooks/useMonthNavigation'
import { monthLabel, monthKey, getMonthRange } from '@/lib/dateHelpers'
import { formatKRW } from '@/lib/utils'

interface TxRow {
  type: 'income' | 'expense'
  amount_krw: number
  categories: { name: string; icon: string; color: string } | null
}

interface MonthData {
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

export default function ReportPage() {
  const supabase = useSupabaseClient()
  const { year, month, isCurrentMonth, navigateMonth } = useMonthNavigation({ disableFuture: true })

  const [dataCache, setDataCache] = useState<Record<string, MonthData>>({})
  const [loading, setLoading] = useState(false)

  const prevYear  = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1

  const fetchMonth = useCallback(async (y: number, m: number): Promise<MonthData | null> => {
    const key = monthKey(y, m)
    if (dataCache[key]) return dataCache[key]

    const { start, end } = getMonthRange(y, m)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('transactions')
      .select('type, amount_krw, categories(name, icon, color)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lt('date', end)

    if (!data) return null
    const rows = data as TxRow[]

    const income  = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const expense = rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)

    const catMap: Record<string, { name: string; icon: string; color: string; total: number }> = {}
    rows.filter(t => t.type === 'expense' && t.categories).forEach(t => {
      const c = t.categories!
      if (!catMap[c.name]) catMap[c.name] = { ...c, total: 0 }
      catMap[c.name].total += t.amount_krw
    })
    const topCategories = Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 6)

    const result: MonthData = { income, expense, txCount: rows.length, topCategories }
    setDataCache(prev => ({ ...prev, [key]: result }))
    return result
  }, [supabase, dataCache])

  const [current, setCurrent] = useState<MonthData | null>(null)
  const [previous, setPrevious] = useState<MonthData | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchMonth(year, month), fetchMonth(prevYear, prevMonth)]).then(([cur, prev]) => {
      setCurrent(cur)
      setPrevious(prev)
      setLoading(false)
    })
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!current) return null
    const balance = current.income - current.expense
    const savingsRate = current.income > 0 ? ((current.income - current.expense) / current.income) * 100 : 0
    const prevBalance = previous ? previous.income - previous.expense : 0
    const prevSavings = previous && previous.income > 0 ? ((previous.income - previous.expense) / previous.income) * 100 : 0
    return {
      balance, savingsRate,
      incomeDelta:   delta(current.income,  previous?.income  ?? 0),
      expenseDelta:  delta(current.expense, previous?.expense ?? 0),
      balanceDelta:  delta(balance,         prevBalance),
      savingsDelta:  savingsRate - prevSavings,
    }
  }, [current, previous])

  const isEmpty = !loading && current && current.income === 0 && current.expense === 0

  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Report</h1>
          <p className="text-[13px] font-bold opacity-50 uppercase tracking-widest mt-1">Monthly summary</p>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-1 bg-[var(--color-card-elevated-base)] rounded-2xl px-2 py-1.5 border border-[var(--color-border-base)]">
          <button onClick={() => navigateMonth(-1)} aria-label="Previous month" className="p-1.5 rounded-xl active:scale-90 transition-transform">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[12px] font-black tracking-tight px-1 min-w-[110px] text-center" style={{ color: 'var(--color-text-primary)' }}>
            {monthLabel(year, month)}
          </span>
          <button onClick={() => navigateMonth(1)} disabled={isCurrentMonth} aria-label="Next month" className="p-1.5 rounded-xl active:scale-90 transition-transform disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-[24px]" />)}
          </motion.div>
        ) : isEmpty ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center rounded-[32px] border border-dashed border-[var(--color-border-base)]" style={{ backgroundColor: 'var(--color-card-base)' }}>
            <div className="w-20 h-20 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center mb-6">
              <FileText className="w-9 h-9 opacity-30" />
            </div>
            <h3 className="text-xl font-black mb-2">No data for this month</h3>
            <p className="text-sm font-medium opacity-50 max-w-[220px] leading-relaxed">No transactions were recorded in {monthLabel(year, month)}.</p>
          </motion.div>
        ) : current && stats ? (
          <motion.div key={`${year}-${month}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Hero card */}
            <div
              className="relative overflow-hidden rounded-[32px] border border-white/10 p-6 shadow-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.06) 100%)', backdropFilter: 'blur(20px)' }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">Net Balance</p>
              <p className="text-[clamp(1.75rem,8vw,4rem)] font-black leading-none tracking-tighter mb-2 break-all"
                style={{ color: stats.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                {stats.balance >= 0 ? '' : '-'}{formatKRW(Math.abs(stats.balance))}
              </p>
              <div className="flex items-center gap-2">
                <TrendPill pct={stats.balanceDelta} />
                <span className="text-[11px] font-bold opacity-40">vs {monthLabel(prevYear, prevMonth)}</span>
              </div>
              <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Income', value: current.income, color: '#22c55e', delta: stats.incomeDelta, invert: false },
                { label: 'Expense', value: current.expense, color: '#ef4444', delta: stats.expenseDelta, invert: true },
                { label: 'Savings Rate', value: `${stats.savingsRate.toFixed(1)}%`, rawValue: null, color: '#3b82f6', delta: stats.savingsDelta !== 0 ? stats.savingsDelta : null, invert: false },
                { label: 'Transactions', value: `${current.txCount}`, rawValue: null, color: 'var(--color-text-primary)', delta: null, invert: false },
              ].map(stat => (
                <motion.div
                  key={stat.label}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-[20px] p-4 border border-[var(--color-border-base)]"
                  style={{ backgroundColor: 'var(--color-card-base)' }}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">{stat.label}</p>
                  <p className="text-[15px] sm:text-[18px] font-black leading-tight mb-1 break-all" style={{ color: stat.color }}>
                    {typeof stat.value === 'number' ? formatKRW(stat.value) : stat.value}
                  </p>
                  <TrendPill pct={stat.delta ?? null} invert={stat.invert} />
                </motion.div>
              ))}
            </div>

            {/* Top categories */}
            {current.topCategories.length > 0 && (
              <div className="rounded-[24px] border border-[var(--color-border-base)] overflow-hidden" style={{ backgroundColor: 'var(--color-card-base)' }}>
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Top Spending</p>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  {current.topCategories.map((cat, i) => {
                    const max = current.topCategories[0].total
                    const pct = (cat.total / max) * 100
                    const prevCat = previous?.topCategories.find(c => c.name === cat.name)
                    const d = prevCat ? delta(cat.total, prevCat.total) : null
                    return (
                      <motion.div
                        key={cat.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {cat.icon} {cat.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <TrendPill pct={d} invert />
                            <span className="text-[13px] font-black" style={{ color: 'var(--color-text-primary)' }}>
                              {formatKRW(cat.total)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
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

            {/* MoM comparison summary */}
            {previous && (previous.income > 0 || previous.expense > 0) && (
              <div className="rounded-[24px] border border-[var(--color-border-base)] p-5" style={{ backgroundColor: 'var(--color-card-base)' }}>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">vs {monthLabel(prevYear, prevMonth)}</p>
                <div className="space-y-3">
                  {[
                    { label: 'Income', cur: current.income, prev: previous.income, good: true },
                    { label: 'Expense', cur: current.expense, prev: previous.expense, good: false },
                  ].map(row => {
                    const diff = row.cur - row.prev
                    const isMore = diff > 0
                    const color = (row.good ? isMore : !isMore) ? '#22c55e' : '#ef4444'
                    return (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-[13px] font-bold opacity-60">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-black" style={{ color }}>
                            {diff >= 0 ? '+' : ''}{formatKRW(diff)}
                          </span>
                          <span className="text-[11px] opacity-30 font-medium">
                            from {formatKRW(row.prev)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
