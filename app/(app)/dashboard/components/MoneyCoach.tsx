'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sparkles, TrendingUp, AlertTriangle, Lightbulb, ChevronDown, Clock, X, Check, RefreshCw,
} from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { invalidateBudgetsCache } from '@/hooks/useBudgets'
import { formatKRW, haptic } from '@/lib/utils'
import { formatEvidenceEntries, formatPeriodLabel, CONFIDENCE_LABEL } from '@/lib/finance/insight-display'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { AIFinancialInsight, InsightSeverity } from '@/lib/types'

interface InsightAction {
  kind: 'adjust_budget' | 'review_subscriptions' | 'review_goal_plan' | 'review_duplicates' | 'view_analytics' | 'none'
  label: string
  href?: string
  categoryId?: string
  categoryName?: string
  currentValueKrw?: number
  proposedValueKrw?: number
  goalId?: string
  goalName?: string
  currentMonthlyUsd?: number
  proposedMonthlyUsd?: number
}

const SEVERITY_STYLE: Record<InsightSeverity, { border: string; bg: string; accent: string; icon: typeof TrendingUp }> = {
  positive: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/10', accent: 'text-emerald-400', icon: TrendingUp },
  info: { border: 'border-blue-500/25', bg: 'bg-blue-500/10', accent: 'text-blue-400', icon: Lightbulb },
  warning: { border: 'border-amber-500/25', bg: 'bg-amber-500/10', accent: 'text-amber-400', icon: AlertTriangle },
  critical: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', accent: 'text-rose-400', icon: AlertTriangle },
}

function getAction(insight: AIFinancialInsight): InsightAction {
  const raw = (insight.evidence as { action?: InsightAction } | null)?.action
  return raw ?? { kind: 'none', label: '' }
}

export function MoneyCoach() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const reduceMotion = useReducedMotion()

  const [insights, setInsights] = useState<AIFinancialInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [coachDisabled, setCoachDisabled] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingBudget, setPendingBudget] = useState<{ insight: AIFinancialInsight; action: InsightAction } | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const response = await fetch(`/api/ai/insights${refresh ? '?refresh=1' : ''}`)
      if (!response.ok) return
      const data = await response.json()
      setInsights(data.insights ?? [])
      setCoachDisabled(Boolean(data.coachDisabled))
      if (refresh && data.rateLimited) {
        toast.info('Insights were refreshed recently. Try again in a moment.')
      }
    } catch {
      // Silent — the coach is supplementary, the rest of the dashboard stands alone.
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const updateStatus = useCallback(
    async (id: string, action: 'review' | 'accept' | 'dismiss' | 'snooze', snoozeDays?: number) => {
      const response = await fetch('/api/ai/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, snoozeDays }),
      })
      return response.ok
    },
    []
  )

  const handleDismiss = async (insight: AIFinancialInsight) => {
    haptic('light')
    setInsights((prev) => prev.filter((i) => i.id !== insight.id))
    const ok = await updateStatus(insight.id, 'dismiss')
    if (!ok) {
      setInsights((prev) => [...prev, insight])
      toast.error('Could not dismiss this insight')
    }
  }

  const handleSnooze = async (insight: AIFinancialInsight) => {
    haptic('light')
    setInsights((prev) => prev.filter((i) => i.id !== insight.id))
    const ok = await updateStatus(insight.id, 'snooze', 7)
    if (ok) toast.success('Snoozed for a week')
    else {
      setInsights((prev) => [...prev, insight])
      toast.error('Could not snooze this insight')
    }
  }

  const handleReview = (insight: AIFinancialInsight) => {
    haptic('light')
    const next = expandedId === insight.id ? null : insight.id
    setExpandedId(next)
    if (next) void updateStatus(insight.id, 'review')
  }

  // Applying is always explicit: budget changes open a confirmation dialog
  // first, everything else navigates to the page where the user decides.
  const handleApply = (insight: AIFinancialInsight) => {
    const action = getAction(insight)
    haptic('medium')

    if (action.kind === 'adjust_budget' && action.categoryId && action.proposedValueKrw !== undefined) {
      setPendingBudget({ insight, action })
      return
    }

    void updateStatus(insight.id, 'accept')
    if (action.href) router.push(action.href)
  }

  const applyBudgetChange = async () => {
    if (!pendingBudget) return
    const { insight, action } = pendingBudget

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      toast.error('Please sign in again')
      return
    }

    const { error } = await supabase.from('budgets').upsert(
      {
        user_id: user.id,
        category_id: action.categoryId,
        amount_krw: action.proposedValueKrw,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category_id' }
    )

    if (error) {
      console.error('[MoneyCoach] Budget update failed:', error)
      toast.error('Could not update the budget')
      return
    }

    invalidateBudgetsCache()
    await updateStatus(insight.id, 'accept')
    setInsights((prev) => prev.filter((i) => i.id !== insight.id))
    setPendingBudget(null)
    toast.success(`${action.categoryName} budget set to ${formatKRW(action.proposedValueKrw!)}`)
  }

  const budgetImpact = useMemo(() => {
    if (!pendingBudget) return undefined
    const { currentValueKrw = 0, proposedValueKrw = 0, categoryName } = pendingBudget.action
    const delta = proposedValueKrw - currentValueKrw
    if (currentValueKrw === 0) return `${categoryName} will have a monthly plan of ${formatKRW(proposedValueKrw)} for the first time.`
    if (delta < 0) return `This lowers the ${categoryName} plan by ${formatKRW(Math.abs(delta))} a month, about ${formatKRW(Math.abs(delta) * 12)} across a year.`
    return `This raises the ${categoryName} plan by ${formatKRW(delta)} a month so it matches what this category actually costs.`
  }, [pendingBudget])

  if (coachDisabled) return null

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="skeleton h-5 w-40 rounded-lg" />
        <div className="skeleton h-32 rounded-[28px]" />
        <div className="skeleton h-32 rounded-[28px]" />
      </div>
    )
  }

  if (insights.length === 0) return null

  return (
    <section aria-labelledby="money-coach-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/15">
            <Sparkles size={15} className="text-blue-400" aria-hidden />
          </div>
          <h2 id="money-coach-heading" className="truncate text-sm font-semibold text-[var(--color-text-secondary)]">
            AI Money Coach
          </h2>
        </div>
        <button
          type="button"
          onClick={() => { haptic('light'); void load(true) }}
          disabled={refreshing}
          aria-label="Refresh insights"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-base)] transition-transform active:scale-95 disabled:opacity-40"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin opacity-70' : 'opacity-60'} aria-hidden />
        </button>
      </div>

      <div className="space-y-3.5">
        <AnimatePresence initial={false}>
          {insights.map((insight) => {
            const style = SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.info
            const Icon = style.icon
            const action = getAction(insight)
            const isExpanded = expandedId === insight.id
            const evidenceEntries = formatEvidenceEntries(insight.evidence as Record<string, unknown>)

            return (
              <motion.article
                key={insight.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`relative overflow-hidden rounded-[28px] border p-5 shadow-sm ${style.border} ${style.bg}`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 ${style.accent}`}>
                    <Icon size={16} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold leading-snug tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                      {insight.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                      {insight.summary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDismiss(insight)}
                    aria-label={`Dismiss: ${insight.title}`}
                    className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-40 transition-opacity hover:opacity-100"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>

                {/* Evidence, period and confidence — always visible so the card can be trusted at a glance. */}
                <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-medium">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-[var(--color-text-secondary)]">
                    {formatPeriodLabel(insight.period_start, insight.period_end)}
                  </span>
                  <span className={`rounded-lg bg-white/5 px-2 py-1 ${style.accent}`}>
                    {CONFIDENCE_LABEL[insight.confidence] ?? insight.confidence}
                  </span>
                  {insight.estimated_monthly_savings_krw !== null && insight.estimated_monthly_savings_krw > 0 && (
                    <span className="rounded-lg bg-white/5 px-2 py-1 font-mono tabular-nums text-[var(--color-text-secondary)]">
                      ≈ {formatKRW(insight.estimated_monthly_savings_krw)}/mo
                    </span>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && evidenceEntries.length > 0 && (
                    <motion.div
                      key="evidence"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-[var(--color-border-base)] bg-black/10 p-4">
                        {evidenceEntries.map((entry) => (
                          <div key={entry.key} className="min-w-0">
                            <dt className="truncate text-[10px] font-bold uppercase tracking-wider opacity-45">{entry.label}</dt>
                            <dd className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                              {entry.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap items-center gap-2">
                  {evidenceEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleReview(insight)}
                      aria-expanded={isExpanded}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--color-border-base)] px-3.5 py-2 text-xs font-bold transition-transform active:scale-95"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Review
                      <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                  )}

                  {action.kind !== 'none' && (
                    <button
                      type="button"
                      onClick={() => handleApply(insight)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent-base)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                    >
                      <Check size={13} aria-hidden />
                      {action.label}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSnooze(insight)}
                    aria-label={`Snooze for a week: ${insight.title}`}
                    className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold opacity-55 transition-opacity hover:opacity-90"
                  >
                    <Clock size={13} aria-hidden />
                    Snooze
                  </button>
                </div>
              </motion.article>
            )
          })}
        </AnimatePresence>
      </div>

      <p className="px-1 text-[11px] leading-relaxed opacity-40">
        AI insights are budgeting guidance, not professional investment, tax or legal advice.
      </p>

      <ConfirmDialog
        isOpen={pendingBudget !== null}
        onClose={() => setPendingBudget(null)}
        onConfirm={applyBudgetChange}
        title="Confirm budget change"
        description={pendingBudget?.insight.summary}
        comparison={
          pendingBudget
            ? {
                label: `${pendingBudget.action.categoryName} monthly budget`,
                from: pendingBudget.action.currentValueKrw ? formatKRW(pendingBudget.action.currentValueKrw) : 'No budget',
                to: formatKRW(pendingBudget.action.proposedValueKrw ?? 0),
              }
            : undefined
        }
        impact={budgetImpact}
        confirmLabel="Apply budget"
      />
    </section>
  )
}
