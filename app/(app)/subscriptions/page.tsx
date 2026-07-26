'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { RefreshCw, Repeat, Layers, Info } from 'lucide-react'
import { formatKRW, haptic } from '@/lib/utils'
import { findSubscriptionOverlaps } from '@/lib/finance/analysis/subscription-groups'
import type { SubscriptionDecisionStatus } from '@/lib/types'

interface SubscriptionRow {
  key: string
  name: string
  variantDescriptions: string[]
  latestAmountKrw: number
  averageAmountKrw: number
  frequency: 'monthly' | 'yearly' | 'irregular'
  lastPaymentDate: string
  estimatedYearlyCostKrw: number
  confidence: 'high' | 'medium' | 'low'
  occurrenceCount: number
  categoryName: string | null
  averageIntervalDays: number | null
  status: SubscriptionDecisionStatus
  note: string | null
}

interface Summary {
  totalCount: number
  activeCount: number
  totalYearlyKrw: number
  totalMonthlyKrw: number
}

const STATUS_OPTIONS: Array<{ value: SubscriptionDecisionStatus; label: string; color: string }> = [
  { value: 'keep', label: 'Keep', color: '#22c55e' },
  { value: 'review', label: 'Review', color: '#f59e0b' },
  { value: 'plan_to_cancel', label: 'Plan to cancel', color: '#f97316' },
  { value: 'cancelled', label: 'Cancelled', color: '#94a3b8' },
]

const FREQUENCY_LABEL: Record<SubscriptionRow['frequency'], string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  irregular: 'Irregular',
}

const CONFIDENCE_LABEL: Record<SubscriptionRow['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Possible',
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SubscriptionsPage() {
  const reduceMotion = useReducedMotion()
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/finance/subscriptions')
      if (!response.ok) {
        toast.error('Could not load subscriptions')
        return
      }
      const data = await response.json()
      setSubscriptions(data.subscriptions ?? [])
      setSummary(data.summary ?? null)
    } catch {
      toast.error('Could not load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const updateStatus = async (row: SubscriptionRow, status: SubscriptionDecisionStatus) => {
    if (row.status === status) return
    haptic('light')
    setSavingKey(row.key)

    const previous = row.status
    setSubscriptions((prev) => prev.map((s) => (s.key === row.key ? { ...s, status } : s)))

    try {
      const response = await fetch('/api/finance/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionKey: row.key, displayName: row.name, status }),
      })
      if (!response.ok) throw new Error('save failed')
      if (status === 'plan_to_cancel') {
        toast.success('Marked to cancel — remember to cancel it with the provider too')
      }
    } catch {
      setSubscriptions((prev) => prev.map((s) => (s.key === row.key ? { ...s, status: previous } : s)))
      toast.error('Could not save that change')
    } finally {
      setSavingKey(null)
    }
  }

  const overlaps = useMemo(() => findSubscriptionOverlaps(subscriptions), [subscriptions])

  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Subscriptions
          </h1>
          <p className="mt-1 text-[13px] font-bold uppercase tracking-widest opacity-50">Recurring payments</p>
        </div>
        <button
          type="button"
          onClick={() => { haptic('light'); void load() }}
          disabled={loading}
          aria-label="Refresh subscriptions"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border-base)] transition-transform active:scale-95 disabled:opacity-40"
        >
          <RefreshCw size={17} className={loading ? 'animate-spin opacity-70' : 'opacity-60'} aria-hidden />
        </button>
      </div>

      {summary && summary.totalCount > 0 && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 p-5 shadow-2xl sm:p-6"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.05) 100%)' }}
        >
          <div className="relative z-10">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
                <Repeat className="h-5 w-5 text-violet-400" strokeWidth={2.5} aria-hidden />
              </div>
              <p className="text-[13px] font-black uppercase tracking-widest text-violet-400">Recurring cost</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40">Per month</p>
                <p className="break-all text-[15px] font-black leading-tight sm:text-lg" style={{ color: 'var(--color-text-primary)' }}>
                  {formatKRW(summary.totalMonthlyKrw)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40">Per year</p>
                <p className="break-all text-[15px] font-black leading-tight sm:text-lg" style={{ color: 'var(--color-text-primary)' }}>
                  {formatKRW(summary.totalYearlyKrw)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] opacity-40">Active</p>
                <p className="text-[15px] font-black leading-tight sm:text-lg" style={{ color: 'var(--color-text-primary)' }}>
                  {summary.activeCount}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
        </motion.div>
      )}

      {overlaps.length > 0 && (
        <div className="mb-6 space-y-3">
          {overlaps.map((overlap) => (
            <div key={overlap.group} className="flex items-start gap-3 rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Layers size={16} className="text-blue-400" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {overlap.names.length} {overlap.label.toLowerCase()} running together
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                  {overlap.names.join(', ')} come to about {formatKRW(overlap.combinedYearlyCostKrw)} a year combined. Only you can judge whether each one earns its place.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-[28px]" />)}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-[var(--color-border-base)] bg-[var(--color-card-base)] py-20 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-card-elevated-base)] text-4xl">🔁</div>
          <h2 className="mb-2 text-xl font-black">No recurring payments found</h2>
          <p className="max-w-[260px] text-sm font-medium leading-relaxed opacity-50">
            Once the same payment appears a couple of times, it will show up here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="ml-1 text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Detected payments</p>
          <AnimatePresence initial={false}>
            {subscriptions.map((row) => {
              const isCancelled = row.status === 'cancelled'
              return (
                <motion.article
                  key={row.key}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: isCancelled ? 0.6 : 1, y: 0 }}
                  className="rounded-[28px] border border-[var(--color-border-base)] p-5 shadow-sm"
                  style={{ backgroundColor: 'var(--color-card-base)' }}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className={`truncate text-[16px] font-black tracking-tight ${isCancelled ? 'line-through' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                        {row.name}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
                        <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[var(--color-text-secondary)]">
                          {FREQUENCY_LABEL[row.frequency]}
                        </span>
                        <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[var(--color-text-secondary)]">
                          {CONFIDENCE_LABEL[row.confidence]}
                        </span>
                        {row.categoryName && (
                          <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[var(--color-text-secondary)]">{row.categoryName}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-lg font-black tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                        {formatKRW(row.latestAmountKrw)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-40">Latest</p>
                    </div>
                  </div>

                  <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Average amount</dt>
                      <dd className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                        {formatKRW(row.averageAmountKrw)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Yearly cost</dt>
                      <dd className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                        {formatKRW(row.estimatedYearlyCostKrw)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Last payment</dt>
                      <dd className="mt-0.5 truncate text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {formatDate(row.lastPaymentDate)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider opacity-45">Payments seen</dt>
                      <dd className="mt-0.5 truncate text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {row.occurrenceCount}
                      </dd>
                    </div>
                  </dl>

                  {row.variantDescriptions.length > 1 && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
                      <Info size={13} className="mt-0.5 shrink-0 opacity-40" aria-hidden />
                      <p className="text-[11px] leading-relaxed opacity-55">
                        Grouped from: {row.variantDescriptions.join(', ')}
                      </p>
                    </div>
                  )}

                  <div role="group" aria-label={`Status for ${row.name}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STATUS_OPTIONS.map((option) => {
                      const active = row.status === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateStatus(row, option.value)}
                          disabled={savingKey === row.key}
                          aria-pressed={active}
                          className="min-h-[44px] rounded-xl border px-2 py-2 text-[11px] font-black uppercase tracking-wider transition-transform active:scale-95 disabled:opacity-50"
                          style={{
                            borderColor: active ? option.color : 'var(--color-border-base)',
                            backgroundColor: active ? `${option.color}1f` : 'transparent',
                            color: active ? option.color : 'var(--color-text-secondary)',
                          }}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </motion.article>
              )
            })}
          </AnimatePresence>

          <p className="px-1 pt-2 text-[11px] leading-relaxed opacity-40">
            Money Flow never cancels anything for you. Marking a payment here is a note to yourself — cancel with the provider directly.
          </p>
        </div>
      )}
    </div>
  )
}
