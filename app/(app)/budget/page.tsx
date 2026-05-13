'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronLeft, ChevronRight, Pencil, Check, X, TrendingUp, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets, invalidateBudgetsCache } from '@/hooks/useBudgets'
import { useMonthNavigation } from '@/hooks/useMonthNavigation'
import { monthLabel, getMonthRange } from '@/lib/dateHelpers'
import { formatKRW, formatNumber, haptic } from '@/lib/utils'
import type { Category, Budget } from '@/lib/types'

interface CategorySpend {
  category_id: string
  spent: number
}

interface BudgetRow extends Budget {
  category: Category
  spent: number
  pct: number
}

function getBarColor(pct: number) {
  if (pct >= 100) return '#ef4444'
  if (pct >= 80) return '#f59e0b'
  return '#22c55e'
}

export default function BudgetPage() {
  const supabase = useSupabaseClient()
  const { year, month, isCurrentMonth, navigateMonth } = useMonthNavigation()

  const { categories: allCategories } = useCategories()
  const { budgets: cachedBudgets } = useBudgets()
  const categories = useMemo(
    () => allCategories.filter(c => c.type === 'expense' || c.type === 'both'),
    [allCategories]
  )
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [spends, setSpends] = useState<CategorySpend[]>([])
  const [loading, setLoading] = useState(true)

  // Sync from global cache on first load
  useEffect(() => {
    if (cachedBudgets.length > 0 && budgets.length === 0) setBudgets(cachedBudgets)
  }, [cachedBudgets]) // eslint-disable-line react-hooks/exhaustive-deps

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { start, end } = getMonthRange(year, month)

    const { data: txData } = await supabase
      .from('transactions')
      .select('category_id, amount_krw')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', start)
      .lt('date', end)

    if (txData) {
      const map: Record<string, number> = {}
      for (const tx of txData) {
        if (tx.category_id) map[tx.category_id] = (map[tx.category_id] ?? 0) + tx.amount_krw
      }
      setSpends(Object.entries(map).map(([category_id, spent]) => ({ category_id, spent })))
    }

    setLoading(false)
  }, [supabase, year, month])

  useEffect(() => { load() }, [load])

  const saveBudget = async (categoryId: string) => {
    const raw = editInput.replace(/,/g, '')
    const amount = parseFloat(raw)
    if (isNaN(amount) || amount < 0) { toast.error('Invalid amount'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('budgets').upsert(
      { user_id: user.id, category_id: categoryId, amount_krw: amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category_id' }
    )
    if (error) { toast.error('Failed to save'); return }

    setBudgets(prev => {
      const exists = prev.find(b => b.category_id === categoryId)
      if (exists) return prev.map(b => b.category_id === categoryId ? { ...b, amount_krw: amount } : b)
      return [...prev, { category_id: categoryId, amount_krw: amount }]
    })
    invalidateBudgetsCache()
    haptic('medium')
    toast.success('Budget saved')
    setEditingId(null)
  }

  const spendMap = Object.fromEntries(spends.map(s => [s.category_id, s.spent]))
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category_id, b.amount_krw]))

  const budgeted: BudgetRow[] = categories
    .filter(c => (budgetMap[c.id] ?? 0) > 0)
    .map(c => {
      const budget = budgetMap[c.id]
      const spent = spendMap[c.id] ?? 0
      return { category_id: c.id, amount_krw: budget, category: c, spent, pct: Math.min((spent / budget) * 100, 100) }
    })
    .sort((a, b) => b.pct - a.pct)

  const unbudgeted = categories.filter(c => !(budgetMap[c.id] > 0))

  const totalBudget = budgets.reduce((s, b) => s + b.amount_krw, 0)
  const totalSpent = budgeted.reduce((s, r) => s + r.spent, 0)
  const totalPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const totalRemaining = totalBudget - totalSpent
  const overBudgetCount = budgeted.filter(r => r.pct >= 100).length


  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Budget</h1>
          <p className="text-[13px] font-bold opacity-50 uppercase tracking-widest mt-1">Monthly limits</p>
        </div>
        {/* Month selector */}
        <div className="flex items-center gap-1 bg-[var(--color-card-elevated-base)] rounded-2xl px-2 py-1.5 border border-[var(--color-border-base)]">
          <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-xl active:scale-90 transition-transform">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[12px] font-black tracking-tight px-1 min-w-[100px] text-center" style={{ color: 'var(--color-text-primary)' }}>
            {monthLabel(year, month)}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-xl active:scale-90 transition-transform disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary card */}
      {totalBudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-[32px] border border-white/10 p-5 shadow-2xl sm:p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.05) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="relative z-10">
            {/* Top row */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-green-400" strokeWidth={2.5} />
                </div>
                <p className="text-[13px] font-black uppercase tracking-widest text-green-400">Month Overview</p>
              </div>
              {overBudgetCount > 0 && (
                <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/20 rounded-xl px-3 py-1.5">
                  <AlertTriangle size={13} className="text-red-400" />
                  <span className="text-[11px] font-black text-red-400">{overBudgetCount} over limit</span>
                </div>
              )}
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40 mb-1">Budget</p>
                <p className="text-[13px] sm:text-base font-black leading-tight break-all" style={{ color: 'var(--color-text-primary)' }}>
                  {formatKRW(totalBudget)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40 mb-1">Spent</p>
                <p className="text-[13px] sm:text-base font-black leading-tight break-all" style={{ color: totalSpent > totalBudget ? '#ef4444' : 'var(--color-text-primary)' }}>
                  {formatKRW(totalSpent)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40 mb-1">Left</p>
                <p className="text-[13px] sm:text-base font-black leading-tight break-all" style={{ color: totalRemaining >= 0 ? '#22c55e' : '#ef4444' }}>
                  {totalRemaining >= 0 ? formatKRW(totalRemaining) : `-${formatKRW(Math.abs(totalRemaining))}`}
                </p>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[11px] font-bold opacity-40">Overall</span>
                <span className="text-[11px] font-black" style={{ color: getBarColor(totalPct) }}>{totalPct.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden shadow-inner">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${totalPct}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.1 }}
                  style={{ backgroundColor: getBarColor(totalPct), boxShadow: `0 0 12px ${getBarColor(totalPct)}60` }}
                />
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl" />
        </motion.div>
      )}

      {/* Budgeted categories */}
      {!loading && budgeted.length > 0 && (
        <div className="space-y-4 mb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 ml-1">Active Budgets</p>
          <AnimatePresence>
            {budgeted.map((row, i) => {
              const barColor = getBarColor(row.pct)
              const isEditing = editingId === row.category_id
              const remaining = row.amount_krw - row.spent

              return (
                <motion.div
                  key={row.category_id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group rounded-[24px] border border-[var(--color-border-base)] p-4 sm:p-5 transition-all"
                  style={{ backgroundColor: 'var(--color-card-base)' }}
                >
                  {/* Category header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: `${row.category.color}18`, border: `1px solid ${row.category.color}30` }}
                      >
                        {row.category.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-[15px] truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {row.category.name}
                        </p>
                        <p className="text-[11px] font-bold opacity-40">
                          {remaining >= 0
                            ? `${formatKRW(remaining)} remaining`
                            : `${formatKRW(Math.abs(remaining))} over budget`}
                        </p>
                      </div>
                    </div>

                    {/* Edit / confirm buttons */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => saveBudget(row.category_id)}
                          className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center active:scale-90 transition-all"
                        >
                          <Check size={14} className="text-green-400" strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="w-8 h-8 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center active:scale-90 transition-all"
                        >
                          <X size={14} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(row.category_id); setEditInput(formatNumber(row.amount_krw)) }}
                        className="w-8 h-8 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center opacity-0 group-hover:opacity-100 active:scale-90 transition-all md:opacity-0 opacity-100"
                      >
                        <Pencil size={13} className="text-[var(--color-text-secondary)]" />
                      </button>
                    )}
                  </div>

                  {/* Inline budget input */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 overflow-hidden"
                      >
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm opacity-40">₩</span>
                          <input
                            autoFocus
                            value={editInput}
                            onChange={e => setEditInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveBudget(row.category_id)}
                            inputMode="numeric"
                            placeholder="Monthly limit"
                            className="w-full font-black text-right pr-4 py-3 rounded-2xl outline-none text-[15px]"
                            style={{
                              backgroundColor: 'var(--color-card-elevated-base)',
                              border: `2px solid ${row.category.color}`,
                              color: 'var(--color-text-primary)',
                              paddingLeft: '32px',
                            }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[13px] font-black" style={{ color: 'var(--color-text-primary)' }}>
                        {formatKRW(row.spent)}
                        <span className="text-[11px] font-bold opacity-40 ml-1">/ {formatKRW(row.amount_krw)}</span>
                      </span>
                      <span className="text-[12px] font-black" style={{ color: barColor }}>{row.pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-card-elevated-base)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${row.pct}%` }}
                        transition={{ type: 'spring', damping: 15, stiffness: 80 }}
                        style={{ backgroundColor: barColor, boxShadow: `0 0 10px ${barColor}40` }}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 mb-8">
          <div className="skeleton h-6 w-32 rounded-xl" />
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-[24px]" />)}
        </div>
      )}

      {/* Unbudgeted categories */}
      {!loading && unbudgeted.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 ml-1">No Budget Set</p>
          <div className="rounded-[24px] border border-dashed border-[var(--color-border-base)] overflow-hidden">
            {unbudgeted.map((cat, i) => {
              const isEditing = editingId === cat.id
              const spent = spendMap[cat.id] ?? 0

              return (
                <div
                  key={cat.id}
                  className="flex flex-col px-4 py-3.5 transition-all gap-2"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--color-border-base)' : 'none',
                    backgroundColor: 'var(--color-card-base)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${cat.color}15` }}
                    >
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-black truncate" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</p>
                      {spent > 0 && (
                        <p className="text-[11px] font-bold opacity-40">{formatKRW(spent)} spent this month</p>
                      )}
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => { setEditingId(cat.id); setEditInput('') }}
                        className="text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all active:scale-95 shrink-0"
                        style={{ color: cat.color, borderColor: `${cat.color}40`, backgroundColor: `${cat.color}08` }}
                      >
                        Set
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-xs opacity-40">₩</span>
                        <input
                          autoFocus
                          value={editInput}
                          onChange={e => setEditInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveBudget(cat.id)}
                          inputMode="numeric"
                          placeholder="Monthly limit"
                          className="w-full font-black text-right pr-3 py-2 rounded-xl outline-none text-[13px]"
                          style={{
                            backgroundColor: 'var(--color-card-elevated-base)',
                            border: `2px solid ${cat.color}`,
                            color: 'var(--color-text-primary)',
                            paddingLeft: '28px',
                          }}
                        />
                      </div>
                      <button onClick={() => saveBudget(cat.id)} className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center active:scale-90 shrink-0">
                        <Check size={14} className="text-green-400" strokeWidth={3} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="w-9 h-9 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center active:scale-90 shrink-0">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[var(--color-card-base)] rounded-[32px] border border-dashed border-[var(--color-border-base)]">
          <div className="w-20 h-20 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center text-4xl mb-6">
            <TrendingUp className="w-9 h-9 opacity-30" />
          </div>
          <h3 className="text-xl font-black mb-2">No categories yet</h3>
          <p className="text-sm font-medium opacity-50 max-w-[240px] leading-relaxed">
            Add expense categories in Settings to start setting budgets.
          </p>
        </div>
      )}
    </div>
  )
}
