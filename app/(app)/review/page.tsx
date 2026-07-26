'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Repeat, Target, Check } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { invalidateBudgetsCache } from '@/hooks/useBudgets'
import { formatKRW, haptic } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { GoalStatus } from '@/lib/finance/analysis'

interface Totals {
  totalIncomeKrw: number
  totalExpenseKrw: number
  netCashFlowKrw: number
  savingsRatePct: number
  transactionCount: number
}

interface ComparisonEntry {
  categoryId: string | null
  categoryName: string
  currentKrw: number
  previousKrw: number
  deltaKrw: number
  deltaPct: number | null
  direction: 'up' | 'down' | 'flat' | 'new' | 'stopped'
}

interface BudgetPerformanceEntry {
  categoryId: string
  categoryName: string
  budgetKrw: number
  spentKrw: number
  remainingKrw: number
  usagePct: number
  overBudget: boolean
}

interface Recommendation {
  categoryId: string
  categoryName: string
  currentBudgetKrw: number
  recommendedBudgetKrw: number
  averageKrw: number
  medianKrw: number
  rationale: string
  reason: string
}

interface GoalProgress {
  name: string
  targetUsd: number
  currentUsd: number
  remainingUsd: number
  status: GoalStatus
  requiredMonthlyUsd: number | null
  plannedMonthlyUsd: number
}

interface ReviewData {
  month: string
  periodStart: string
  periodEnd: string
  totals: Totals
  previousTotals: Totals
  categoryComparison: ComparisonEntry[]
  bestImprovement: ComparisonEntry | null
  biggestIncrease: ComparisonEntry | null
  budgetPerformance: BudgetPerformanceEntry[]
  subscriptions: { count: number; monthlyKrw: number; yearlyKrw: number }
  goalProgress: GoalProgress[]
  nextMonthPlan: { recommendations: Recommendation[]; monthsAnalyzed: string[]; projectedSavingsRatePct: number; targetSavingsRatePct: number; meetsTarget: boolean }
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(year, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const color = tone === 'positive' ? '#22c55e' : tone === 'negative' ? '#ef4444' : 'var(--color-text-primary)'
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40">{label}</p>
      <p className="break-all font-mono text-[15px] font-black leading-tight tabular-nums sm:text-lg" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

export default function MonthlyReviewPage() {
  const supabase = useSupabaseClient()
  const reduceMotion = useReducedMotion()

  const [month, setMonth] = useState(() => shiftMonth(currentMonthKey(), -1))
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmApply, setConfirmApply] = useState(false)

  const load = useCallback(async (targetMonth: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/finance/monthly-review?month=${targetMonth}`)
      if (!response.ok) {
        toast.error('Could not load the monthly review')
        return
      }
      const json = (await response.json()) as ReviewData
      setData(json)
      // Pre-select every recommendation that actually changes something, so
      // the user reviews a concrete plan rather than an empty list.
      setSelected(
        new Set(
          json.nextMonthPlan.recommendations
            .filter((r) => r.recommendedBudgetKrw !== r.currentBudgetKrw)
            .map((r) => r.categoryId)
        )
      )
    } catch {
      toast.error('Could not load the monthly review')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(month) }, [load, month])

  const toggle = (categoryId: string) => {
    haptic('light')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const selectedRecommendations = useMemo(
    () => (data?.nextMonthPlan.recommendations ?? []).filter((r) => selected.has(r.categoryId)),
    [data, selected]
  )

  const applyPlan = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user || selectedRecommendations.length === 0) return

    const rows = selectedRecommendations.map((r) => ({
      user_id: user.id,
      category_id: r.categoryId,
      amount_krw: r.recommendedBudgetKrw,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category_id' })
    if (error) {
      console.error('[MonthlyReview] Budget apply failed:', error)
      toast.error('Could not apply the plan')
      return
    }

    invalidateBudgetsCache()
    setConfirmApply(false)
    toast.success(`Updated ${rows.length} ${rows.length === 1 ? 'budget' : 'budgets'}`)
    void load(month)
  }

  const isCurrentMonth = month === currentMonthKey()

  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Monthly review
          </h1>
          <p className="mt-1 text-[13px] font-bold uppercase tracking-widest opacity-50">{monthLabel(month)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-[var(--color-border-base)] px-2 py-1.5" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
          <button
            type="button"
            onClick={() => { haptic('light'); setMonth(shiftMonth(month, -1)) }}
            aria-label="Previous month"
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-90"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => { haptic('light'); setMonth(shiftMonth(month, 1)) }}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-90 disabled:opacity-30"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-40 rounded-[28px]" />)}
        </div>
      ) : !data ? null : data.totals.transactionCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-[var(--color-border-base)] py-20 text-center" style={{ backgroundColor: 'var(--color-card-base)' }}>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-card-elevated-base)] text-4xl">📄</div>
          <h2 className="mb-2 text-xl font-black">Nothing recorded for {monthLabel(month)}</h2>
          <p className="max-w-[260px] text-sm font-medium leading-relaxed opacity-50">
            Pick another month, or start logging transactions to build your first review.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Headline numbers */}
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            aria-label="Month summary"
            className="relative overflow-hidden rounded-[32px] border border-white/10 p-5 shadow-2xl sm:p-6"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.05) 100%)' }}
          >
            <div className="relative z-10 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              <Stat label="Income" value={formatKRW(data.totals.totalIncomeKrw)} />
              <Stat label="Spending" value={formatKRW(data.totals.totalExpenseKrw)} />
              <Stat
                label="Net"
                value={formatKRW(data.totals.netCashFlowKrw)}
                tone={data.totals.netCashFlowKrw >= 0 ? 'positive' : 'negative'}
              />
              <Stat
                label="Savings rate"
                value={`${data.totals.savingsRatePct}%`}
                tone={data.totals.savingsRatePct >= 0 ? 'positive' : 'negative'}
              />
            </div>
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          </motion.section>

          {/* Wins and watch-outs */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.bestImprovement && (
              <section className="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-4" aria-label="Best improvement">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingDown size={15} className="text-emerald-400" aria-hidden />
                  <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Best improvement</p>
                </div>
                <p className="text-[15px] font-black" style={{ color: 'var(--color-text-primary)' }}>
                  {data.bestImprovement.categoryName}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed opacity-65">
                  Down {formatKRW(Math.abs(data.bestImprovement.deltaKrw))} from {formatKRW(data.bestImprovement.previousKrw)} last month.
                </p>
              </section>
            )}

            {data.biggestIncrease && (
              <section className="rounded-[24px] border border-amber-500/25 bg-amber-500/10 p-4" aria-label="Biggest increase">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp size={15} className="text-amber-400" aria-hidden />
                  <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">Worth a look</p>
                </div>
                <p className="text-[15px] font-black" style={{ color: 'var(--color-text-primary)' }}>
                  {data.biggestIncrease.categoryName}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed opacity-65">
                  Up {formatKRW(data.biggestIncrease.deltaKrw)} from {formatKRW(data.biggestIncrease.previousKrw)} last month.
                </p>
              </section>
            )}
          </div>

          {/* Category comparison */}
          <section aria-label="Category comparison">
            <h2 className="mb-3 ml-1 text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Category comparison</h2>
            <div className="overflow-hidden rounded-[24px] border border-[var(--color-border-base)]" style={{ backgroundColor: 'var(--color-card-base)' }}>
              {data.categoryComparison.slice(0, 8).map((entry, i) => (
                <div
                  key={`${entry.categoryId}-${entry.categoryName}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid var(--color-border-base)' : 'none' }}
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {entry.categoryName}
                  </span>
                  <span className="shrink-0 font-mono text-[13px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {formatKRW(entry.currentKrw)}
                  </span>
                  <span
                    className="w-[92px] shrink-0 text-right font-mono text-[11px] font-bold tabular-nums"
                    style={{ color: entry.deltaKrw > 0 ? '#f59e0b' : entry.deltaKrw < 0 ? '#22c55e' : 'var(--color-text-secondary)' }}
                  >
                    {entry.deltaKrw > 0 ? '+' : ''}{formatKRW(entry.deltaKrw)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Budget performance */}
          {data.budgetPerformance.length > 0 && (
            <section aria-label="Budget performance">
              <h2 className="mb-3 ml-1 text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Budget performance</h2>
              <div className="space-y-3">
                {data.budgetPerformance.map((entry) => {
                  const color = entry.usagePct >= 100 ? '#ef4444' : entry.usagePct >= 80 ? '#f59e0b' : '#22c55e'
                  return (
                    <div key={entry.categoryId} className="rounded-[20px] border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-base)' }}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          {entry.categoryName}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] font-black tabular-nums" style={{ color }}>
                          {entry.usagePct}%
                        </span>
                      </div>
                      <div className="mb-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(entry.usagePct, 100)}%`, backgroundColor: color }} />
                      </div>
                      <p className="font-mono text-[11px] tabular-nums opacity-55">
                        {formatKRW(entry.spentKrw)} of {formatKRW(entry.budgetKrw)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Subscriptions + goals */}
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-[24px] border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-base)' }} aria-label="Subscription cost">
              <div className="mb-2 flex items-center gap-2">
                <Repeat size={15} className="text-violet-400" aria-hidden />
                <p className="text-[11px] font-black uppercase tracking-widest opacity-50">Subscriptions</p>
              </div>
              <p className="font-mono text-lg font-black tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {formatKRW(data.subscriptions.monthlyKrw)}
              </p>
              <p className="mt-1 text-[12px] opacity-55">
                {data.subscriptions.count} recurring · {formatKRW(data.subscriptions.yearlyKrw)} a year
              </p>
            </section>

            <section className="rounded-[24px] border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-base)' }} aria-label="Goal progress">
              <div className="mb-2 flex items-center gap-2">
                <Target size={15} className="text-blue-400" aria-hidden />
                <p className="text-[11px] font-black uppercase tracking-widest opacity-50">Goals</p>
              </div>
              {data.goalProgress.length === 0 ? (
                <p className="text-[12px] opacity-55">No savings goals yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.goalProgress.slice(0, 3).map((goal) => (
                    <li key={goal.name} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate opacity-70">{goal.name}</span>
                      <span className="shrink-0 font-mono font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                        ${goal.currentUsd.toLocaleString('en-US')} / ${goal.targetUsd.toLocaleString('en-US')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Proposed plan for next month */}
          {data.nextMonthPlan.recommendations.length > 0 && (
            <section aria-label="Plan for next month">
              <h2 className="mb-1 ml-1 text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Plan for next month</h2>
              <p className="mb-3 ml-1 text-[12px] leading-relaxed opacity-55">
                Based on {data.nextMonthPlan.monthsAnalyzed.length} complete months. Review each one — nothing is applied until you confirm.
              </p>

              <div className="space-y-3">
                {data.nextMonthPlan.recommendations.map((rec) => {
                  const isSelected = selected.has(rec.categoryId)
                  const unchanged = rec.recommendedBudgetKrw === rec.currentBudgetKrw
                  const delta = rec.recommendedBudgetKrw - rec.currentBudgetKrw

                  return (
                    <div
                      key={rec.categoryId}
                      className="rounded-[20px] border p-4 transition-colors"
                      style={{
                        backgroundColor: 'var(--color-card-base)',
                        borderColor: isSelected ? 'var(--color-accent-base)' : 'var(--color-border-base)',
                      }}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={unchanged}
                          onChange={() => toggle(rec.categoryId)}
                          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent-base)]"
                          aria-label={`Apply new budget for ${rec.categoryName}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="text-[14px] font-black" style={{ color: 'var(--color-text-primary)' }}>
                              {rec.categoryName}
                            </span>
                            <span className="font-mono text-[13px] font-bold tabular-nums">
                              {rec.currentBudgetKrw > 0 && (
                                <span className="opacity-40 line-through">{formatKRW(rec.currentBudgetKrw)}</span>
                              )}
                              <span className="ml-2" style={{ color: 'var(--color-text-primary)' }}>
                                {formatKRW(rec.recommendedBudgetKrw)}
                              </span>
                              {!unchanged && (
                                <span className="ml-1.5 text-[11px]" style={{ color: delta < 0 ? '#22c55e' : '#f59e0b' }}>
                                  {delta > 0 ? '+' : ''}{formatKRW(delta)}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="mt-1.5 block text-[12px] leading-relaxed opacity-60">{rec.rationale}</span>
                        </span>
                      </label>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => { haptic('medium'); setConfirmApply(true) }}
                disabled={selectedRecommendations.length === 0}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-button bg-[var(--color-accent-base)] px-5 py-3.5 text-sm font-black text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40"
              >
                <Check size={16} aria-hidden />
                Accept plan for next month
                {selectedRecommendations.length > 0 && ` (${selectedRecommendations.length})`}
              </button>
            </section>
          )}

          <p className="px-1 text-[11px] leading-relaxed opacity-40">
            AI insights are budgeting guidance, not professional investment, tax or legal advice.
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmApply}
        onClose={() => setConfirmApply(false)}
        onConfirm={applyPlan}
        title="Apply next month's plan?"
        description={`This updates ${selectedRecommendations.length} ${selectedRecommendations.length === 1 ? 'budget' : 'budgets'}. Your transactions and savings goals are not affected, and you can change any budget again at any time.`}
        impact={
          selectedRecommendations.length > 0
            ? `New total for these categories: ${formatKRW(selectedRecommendations.reduce((sum, r) => sum + r.recommendedBudgetKrw, 0))} a month.`
            : undefined
        }
        confirmLabel="Apply plan"
      />
    </div>
  )
}
