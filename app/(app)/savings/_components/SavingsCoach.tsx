'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Compass, AlertTriangle, ChevronDown, CalendarClock } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { haptic } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { GoalStatus } from '@/lib/finance/analysis'

interface ContributionEntry {
  amountUsd: number
  month: string
  source: 'manual' | 'planned'
  createdAt: string
}

interface GoalPlan {
  goalId: string
  name: string
  targetUsd: number
  currentUsd: number
  remainingUsd: number
  surplusUsd: number
  deadline: string | null
  monthsRemaining: number | null
  currentPlannedMonthlyUsd: number
  requiredMonthlyUsd: number | null
  effectiveMonthlyRateUsd: number
  projectedCompletionDate: string | null
  status: GoalStatus
  contributionHistory: ContributionEntry[]
  contributionCount: number
}

interface DoubleCountingWarning {
  goalIds: [string, string]
  goalNames: [string, string]
  reason: string
}

const STATUS_META: Record<GoalStatus, { label: string; color: string }> = {
  achieved: { label: 'Achieved', color: '#22c55e' },
  on_track: { label: 'On track', color: '#22c55e' },
  at_risk: { label: 'At risk', color: '#f59e0b' },
  off_track: { label: 'Needs attention', color: '#ef4444' },
  no_deadline: { label: 'No deadline', color: '#94a3b8' },
  no_data: { label: 'Not enough data', color: '#94a3b8' },
}

function usd(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function SavingsCoach({ onPlanSaved }: { onPlanSaved?: () => void }) {
  const supabase = useSupabaseClient()
  const reduceMotion = useReducedMotion()

  const [plans, setPlans] = useState<GoalPlan[]>([])
  const [warnings, setWarnings] = useState<DoubleCountingWarning[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<GoalPlan | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/finance/goal-plans')
      if (!response.ok) return
      const data = await response.json()
      setPlans(data.plans ?? [])
      setWarnings(data.doubleCountingWarnings ?? [])
    } catch {
      // Coaching is supplementary — the goals list works without it.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Saves a planned monthly amount only. The balance still changes only when
  // the user confirms a real contribution.
  const applyContributionPlan = async () => {
    if (!pendingPlan || pendingPlan.requiredMonthlyUsd === null) return

    const { error } = await supabase
      .from('savings_goals')
      .update({ auto_monthly_usd: pendingPlan.requiredMonthlyUsd, updated_at: new Date().toISOString() })
      .eq('id', pendingPlan.goalId)

    if (error) {
      console.error('[SavingsCoach] Plan update failed:', error)
      toast.error('Could not save the contribution plan')
      return
    }

    toast.success(`${pendingPlan.name} plan set to ${usd(pendingPlan.requiredMonthlyUsd)} a month`)
    setPendingPlan(null)
    await load()
    onPlanSaved?.()
  }

  const needsAttention = plans.filter((p) => p.status === 'at_risk' || p.status === 'off_track')

  if (loading || (plans.length === 0 && warnings.length === 0)) return null

  return (
    <section aria-labelledby="savings-coach-heading" className="mb-8 space-y-4">
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/15">
          <Compass size={15} className="text-blue-400" aria-hidden />
        </div>
        <h2 id="savings-coach-heading" className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Goal coach
        </h2>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-2.5">
          {warnings.map((warning) => (
            <div key={warning.goalIds.join('-')} className="flex items-start gap-3 rounded-[24px] border border-amber-500/25 bg-amber-500/10 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Possible double counting
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{warning.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="space-y-3">
          {needsAttention.map((plan) => {
            const meta = STATUS_META[plan.status]
            const isExpanded = expandedId === plan.goalId
            const shortfall = plan.requiredMonthlyUsd !== null
              ? Math.max(plan.requiredMonthlyUsd - plan.currentPlannedMonthlyUsd, 0)
              : 0

            return (
              <motion.article
                key={plan.goalId}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[28px] border border-[var(--color-border-base)] p-5 shadow-sm"
                style={{ backgroundColor: 'var(--color-card-base)' }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                      {plan.requiredMonthlyUsd !== null && plan.requiredMonthlyUsd > 0
                        ? `Reaching ${usd(plan.targetUsd)} by ${formatDate(plan.deadline)} needs about ${usd(plan.requiredMonthlyUsd)} each month.`
                        : `${usd(plan.remainingUsd)} still to go.`}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>

                <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Planned monthly</dt>
                    <dd className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      {usd(plan.currentPlannedMonthlyUsd)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Needed monthly</dt>
                    <dd className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums" style={{ color: shortfall > 0 ? meta.color : 'var(--color-text-primary)' }}>
                      {plan.requiredMonthlyUsd !== null ? usd(plan.requiredMonthlyUsd) : '—'}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Months left</dt>
                    <dd className="mt-0.5 truncate text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {plan.monthsRemaining ?? '—'}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Projected finish</dt>
                    <dd className="mt-0.5 truncate text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {formatDate(plan.projectedCompletionDate)}
                    </dd>
                  </div>
                </dl>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="history"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-4 rounded-2xl border border-[var(--color-border-base)] p-4">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest opacity-45">
                          Contribution history ({plan.contributionCount})
                        </p>
                        {plan.contributionHistory.length === 0 ? (
                          <p className="text-[12px] leading-relaxed opacity-55">
                            No contributions recorded yet. Confirming a deposit on the goal below will start the history.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {plan.contributionHistory.map((entry, i) => (
                              <li key={`${entry.month}-${i}`} className="flex items-center justify-between gap-3 text-[12px]">
                                <span className="flex min-w-0 items-center gap-2">
                                  <CalendarClock size={12} className="shrink-0 opacity-40" aria-hidden />
                                  <span className="truncate opacity-70">{formatMonth(entry.month)}</span>
                                  {entry.source === 'planned' && (
                                    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-55">
                                      Planned
                                    </span>
                                  )}
                                </span>
                                <span className="shrink-0 font-mono font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                                  {usd(entry.amountUsd)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { haptic('light'); setExpandedId(isExpanded ? null : plan.goalId) }}
                    aria-expanded={isExpanded}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--color-border-base)] px-3.5 py-2 text-xs font-bold transition-transform active:scale-95"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    History
                    <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden />
                  </button>

                  {plan.requiredMonthlyUsd !== null && shortfall > 0 && (
                    <button
                      type="button"
                      onClick={() => { haptic('medium'); setPendingPlan(plan) }}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent-base)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                    >
                      Create contribution plan
                    </button>
                  )}
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingPlan !== null}
        onClose={() => setPendingPlan(null)}
        onConfirm={applyContributionPlan}
        title="Confirm contribution plan"
        description={
          pendingPlan
            ? `This updates the planned monthly amount for ${pendingPlan.name}. Your saved balance does not change — it only moves when you confirm a real deposit.`
            : undefined
        }
        comparison={
          pendingPlan
            ? {
                label: `${pendingPlan.name} monthly plan`,
                from: pendingPlan.currentPlannedMonthlyUsd > 0 ? usd(pendingPlan.currentPlannedMonthlyUsd) : 'No plan',
                to: usd(pendingPlan.requiredMonthlyUsd ?? 0),
              }
            : undefined
        }
        impact={
          pendingPlan && pendingPlan.requiredMonthlyUsd !== null
            ? `Setting aside ${usd(pendingPlan.requiredMonthlyUsd)} a month keeps ${pendingPlan.name} on schedule for ${formatDate(pendingPlan.deadline)}.`
            : undefined
        }
        confirmLabel="Save plan"
      />
    </section>
  )
}
