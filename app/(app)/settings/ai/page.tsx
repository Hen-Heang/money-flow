'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, Sparkles, ShieldCheck, Bell, Trash2, Info, Eye } from 'lucide-react'
import { haptic } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { FinancialPreferences } from '@/lib/types'

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-1">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        {description && <span className="mt-0.5 block text-[12px] leading-relaxed opacity-55">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => { haptic('light'); onChange(!checked) }}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
        style={{ backgroundColor: checked ? 'var(--color-accent-base)' : 'var(--color-card-elevated-base)' }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left]"
          style={{ left: checked ? '26px' : '4px' }}
        />
      </button>
    </label>
  )
}

function Section({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f` }}>
          <Icon size={15} style={{ color }} aria-hidden />
        </div>
        <h2 className="text-[13px] font-black uppercase tracking-widest opacity-60">{title}</h2>
      </div>
      <div
        className="space-y-4 rounded-[24px] border border-[var(--color-border-base)] p-5 shadow-sm"
        style={{ backgroundColor: 'var(--color-card-base)' }}
      >
        {children}
      </div>
    </section>
  )
}

const DATA_SENT_TO_AI = [
  'Monthly income, expense and net totals',
  'Savings rate and spending pace',
  'Spending totals per category and payment method',
  'Budget amounts and how much of each is used',
  'Recurring payment amounts and billing frequency',
  'Savings goal targets, progress and deadlines',
]

const DATA_NEVER_SENT = [
  'Your name, email address or user ID',
  'Authentication tokens or passwords',
  'Bank or card numbers',
  'Database record IDs',
  'Individual transaction rows',
  'Private notes on transactions',
]

export default function AISettingsPage() {
  const reduceMotion = useReducedMotion()
  const [preferences, setPreferences] = useState<FinancialPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDataDetail, setShowDataDetail] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/finance/preferences')
      if (!response.ok) return
      const data = await response.json()
      setPreferences(data.preferences)
    } catch {
      toast.error('Could not load AI settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async (patch: Partial<FinancialPreferences>) => {
    if (!preferences) return
    const previous = preferences
    const next = { ...preferences, ...patch }
    setPreferences(next)
    setSaving(true)

    try {
      const response = await fetch('/api/finance/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) throw new Error('save failed')
    } catch {
      setPreferences(previous)
      toast.error('Could not save that change')
    } finally {
      setSaving(false)
    }
  }

  const deleteInsights = async () => {
    try {
      const response = await fetch('/api/ai/insights', { method: 'DELETE' })
      if (!response.ok) throw new Error('delete failed')
      toast.success('Generated insights deleted')
      setConfirmDelete(false)
    } catch {
      toast.error('Could not delete insights')
    }
  }

  if (loading || !preferences) {
    return (
      <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8" aria-busy="true">
        <div className="skeleton mb-8 h-10 w-48 rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-44 rounded-[24px]" />)}
        </div>
      </div>
    )
  }

  const thresholds = preferences.budget_warning_thresholds
  const quietHours = preferences.quiet_hours

  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8">
      <div className="mb-8">
        <Link
          href="/settings"
          className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-bold opacity-60 transition-opacity hover:opacity-100"
        >
          <ChevronLeft size={16} aria-hidden />
          Settings
        </Link>
        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
          AI Money Coach
        </h1>
        <p className="mt-1 text-[13px] font-bold uppercase tracking-widest opacity-50">Coaching &amp; privacy</p>
      </div>

      <Section title="Coaching" icon={Sparkles} color="#8b5cf6">
        <Toggle
          checked={preferences.ai_coach_enabled}
          onChange={(v) => save({ ai_coach_enabled: v })}
          disabled={saving}
          label="AI coaching"
          description="Show insight cards on your dashboard. Turning this off hides the coach and stops sending anything to the AI provider."
        />
        <div className="h-px bg-[var(--color-border-base)]" />
        <Toggle
          checked={preferences.weekly_review_enabled}
          onChange={(v) => save({ weekly_review_enabled: v })}
          disabled={saving}
          label="Weekly check-in"
          description="A short Monday summary of the week just finished."
        />
        <div className="h-px bg-[var(--color-border-base)]" />
        <Toggle
          checked={preferences.monthly_review_enabled}
          onChange={(v) => save({ monthly_review_enabled: v })}
          disabled={saving}
          label="Monthly review"
          description="A full month-end review with a suggested plan for next month."
        />
        <div className="h-px bg-[var(--color-border-base)]" />
        <div>
          <label htmlFor="savings-target" className="block text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Target savings rate
          </label>
          <p className="mt-0.5 mb-3 text-[12px] leading-relaxed opacity-55">
            Budget recommendations aim to leave this share of your income unspent.
          </p>
          <div className="flex items-center gap-3">
            <input
              id="savings-target"
              type="range"
              min={0}
              max={60}
              step={5}
              value={preferences.target_savings_rate}
              onChange={(e) => setPreferences({ ...preferences, target_savings_rate: Number(e.target.value) })}
              onPointerUp={(e) => save({ target_savings_rate: Number((e.target as HTMLInputElement).value) })}
              className="h-11 flex-1 accent-[var(--color-accent-base)]"
            />
            <span className="w-14 shrink-0 text-right font-mono text-lg font-black tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {preferences.target_savings_rate}%
            </span>
          </div>
        </div>
        <div className="h-px bg-[var(--color-border-base)]" />
        <div>
          <label htmlFor="spending-limit" className="block text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Monthly spending limit
          </label>
          <p className="mt-0.5 mb-3 text-[12px] leading-relaxed opacity-55">
            Optional. The coach warns you if the month is on pace to pass this.
          </p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-40">₩</span>
            <input
              id="spending-limit"
              inputMode="numeric"
              placeholder="No limit set"
              defaultValue={preferences.monthly_spending_limit_krw?.toLocaleString('en-US') ?? ''}
              onBlur={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '')
                const value = raw === '' ? null : Number(raw)
                if (value !== preferences.monthly_spending_limit_krw) save({ monthly_spending_limit_krw: value })
              }}
              className="min-h-[44px] w-full rounded-2xl border py-3 pl-9 pr-4 text-right font-mono font-bold tabular-nums outline-none"
              style={{
                backgroundColor: 'var(--color-card-elevated-base)',
                borderColor: 'var(--color-border-base)',
                color: 'var(--color-text-primary)',
                fontSize: '16px',
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Notifications" icon={Bell} color="#f59e0b">
        <div>
          <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Budget warning thresholds</p>
          <p className="mt-0.5 mb-4 text-[12px] leading-relaxed opacity-55">
            You are warned once per level per month, not every day.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: 'first' as const, label: 'First' },
              { key: 'strong' as const, label: 'Strong' },
              { key: 'over' as const, label: 'Over' },
            ]).map(({ key, label }) => (
              <div key={key}>
                <label htmlFor={`threshold-${key}`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider opacity-45">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={`threshold-${key}`}
                    type="number"
                    min={1}
                    max={200}
                    inputMode="numeric"
                    value={thresholds[key]}
                    onChange={(e) =>
                      setPreferences({ ...preferences, budget_warning_thresholds: { ...thresholds, [key]: Number(e.target.value) } })
                    }
                    onBlur={() => save({ budget_warning_thresholds: thresholds })}
                    className="min-h-[44px] w-full rounded-xl border py-2.5 pl-3 pr-7 text-center font-mono font-bold tabular-nums outline-none"
                    style={{
                      backgroundColor: 'var(--color-card-elevated-base)',
                      borderColor: 'var(--color-border-base)',
                      color: 'var(--color-text-primary)',
                      fontSize: '16px',
                    }}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--color-border-base)]" />

        <Toggle
          checked={quietHours.enabled}
          onChange={(v) => save({ quiet_hours: { ...quietHours, enabled: v } })}
          disabled={saving}
          label="Quiet hours"
          description={`No notifications between these times (${quietHours.timezone}).`}
        />

        <AnimatePresence initial={false}>
          {quietHours.enabled && (
            <motion.div
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="quiet-start" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider opacity-45">From</label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => save({ quiet_hours: { ...quietHours, start: e.target.value } })}
                    className="min-h-[44px] w-full rounded-xl border px-3 py-2.5 font-bold outline-none"
                    style={{ backgroundColor: 'var(--color-card-elevated-base)', borderColor: 'var(--color-border-base)', color: 'var(--color-text-primary)', fontSize: '16px' }}
                  />
                </div>
                <div>
                  <label htmlFor="quiet-end" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider opacity-45">Until</label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => save({ quiet_hours: { ...quietHours, end: e.target.value } })}
                    className="min-h-[44px] w-full rounded-xl border px-3 py-2.5 font-bold outline-none"
                    style={{ backgroundColor: 'var(--color-card-elevated-base)', borderColor: 'var(--color-border-base)', color: 'var(--color-text-primary)', fontSize: '16px' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Privacy" icon={ShieldCheck} color="#22c55e">
        <Toggle
          checked={preferences.share_descriptions_with_ai}
          onChange={(v) => save({ share_descriptions_with_ai: v })}
          disabled={saving}
          label="Share merchant names"
          description="Lets insights mention names like “Claude AI Pro”. Turn off to send only amounts and categories."
        />

        <div className="h-px bg-[var(--color-border-base)]" />

        <button
          type="button"
          onClick={() => { haptic('light'); setShowDataDetail((v) => !v) }}
          aria-expanded={showDataDetail}
          className="flex min-h-[44px] w-full items-center gap-3 text-left"
        >
          <Eye size={16} className="shrink-0 opacity-50" aria-hidden />
          <span className="flex-1 text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
            What is sent to the AI
          </span>
          <span className="text-[12px] font-bold opacity-40">{showDataDetail ? 'Hide' : 'Show'}</span>
        </button>

        <AnimatePresence initial={false}>
          {showDataDetail && (
            <motion.div
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 rounded-2xl border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-emerald-400">Sent</p>
                  <ul className="space-y-1.5">
                    {DATA_SENT_TO_AI.map((item) => (
                      <li key={item} className="flex gap-2 text-[12px] leading-relaxed opacity-70">
                        <span aria-hidden>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-rose-400">Never sent</p>
                  <ul className="space-y-1.5">
                    {DATA_NEVER_SENT.map((item) => (
                      <li key={item} className="flex gap-2 text-[12px] leading-relaxed opacity-70">
                        <span aria-hidden>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[11px] leading-relaxed opacity-50">
                  All financial figures are calculated on our server before anything is sent. The AI only rewrites
                  them into plain language, and any wording that introduces an unverified number is discarded.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-px bg-[var(--color-border-base)]" />

        <button
          type="button"
          onClick={() => { haptic('medium'); setConfirmDelete(true) }}
          className="flex min-h-[44px] w-full items-center gap-3 text-left transition-opacity hover:opacity-80"
        >
          <Trash2 size={16} className="shrink-0 text-rose-400" aria-hidden />
          <span className="flex-1">
            <span className="block text-[14px] font-bold text-rose-400">Delete generated insights</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed opacity-55">
              Removes every stored insight. Your transactions, budgets and goals are untouched.
            </span>
          </span>
        </button>
      </Section>

      <div className="flex items-start gap-3 rounded-[24px] border border-[var(--color-border-base)] p-4 opacity-70">
        <Info size={15} className="mt-0.5 shrink-0 opacity-50" aria-hidden />
        <p className="text-[12px] leading-relaxed">
          AI insights are budgeting guidance, not professional investment, tax or legal advice. Always use your own
          judgement for financial decisions.
        </p>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteInsights}
        title="Delete all generated insights?"
        description="Every insight the coach has generated will be removed, including ones you accepted or snoozed. New insights can be generated again at any time. Your transactions, budgets and savings goals are not affected."
        confirmLabel="Delete insights"
        tone="danger"
      />
    </div>
  )
}
