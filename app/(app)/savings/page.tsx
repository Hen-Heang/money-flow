'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Target, Pencil, Trash2, Calendar, ArrowUpRight, CheckCircle2, Bell, SkipForward } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { haptic, formatNumber } from '@/lib/utils'
import { SavingsCoach } from './_components/SavingsCoach'
import { ConfettiCelebration } from './_components/ConfettiCelebration'
import { GoalForm } from './_components/GoalForm'
import { AddDepositSheet } from './_components/AddDepositSheet'
import { useSavingsGoals } from './_hooks/useSavingsGoals'
import { getKstMonthAndDay } from './_lib/kst'
import type { SavingsGoal, ContributionMode } from './_types'

export default function SavingsPage() {
  const {
    goals,
    loading,
    saving,
    skippingGoalId,
    activeGoals,
    completedGoals,
    loadGoals,
    createGoal,
    updateGoal,
    skipMonth,
    deleteGoal,
    applyContribution,
  } = useSavingsGoals()

  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [depositGoal, setDepositGoal] = useState<{ goal: SavingsGoal; mode: ContributionMode } | null>(null)
  const [todayMs] = useState(() => Date.now())
  const [celebrating, setCelebrating] = useState<{ name: string; color: string } | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const totalSaved = goals.reduce((s, g) => s + g.current_usd, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_usd, 0)
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0
  const { month: currentMonth, day: currentDay } = getKstMonthAndDay()

  const daysUntil = (deadline: string | null) => {
    if (!deadline) return null
    const diff = Math.ceil((new Date(deadline).getTime() - todayMs) / 86400000)
    return diff
  }

  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Savings</h1>
          <p className="text-[13px] font-bold opacity-50 uppercase tracking-widest mt-1">Goal tracking</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--color-accent-base)] text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-transform"
        >
          <Plus size={24} strokeWidth={3} />
        </motion.button>
      </div>

      {/* Overall summary - Refined Glassmorphism */}
      {goals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-[32px] border border-white/10 p-5 shadow-2xl sm:p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.05) 100%)',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="relative z-10">
            <div className="mb-6 flex flex-col gap-4 min-[431px]:flex-row min-[431px]:items-center min-[431px]:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-400" strokeWidth={2.5} />
                </div>
                <p className="min-w-0 text-[13px] font-black uppercase tracking-widest text-blue-400">Total Progress</p>
              </div>
              <div className="min-[431px]:text-right">
                <p className="text-2xl font-black text-[var(--color-text-primary)]">{overallPct.toFixed(1)}%</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[13px] font-bold opacity-50 uppercase tracking-widest mb-1">Total Saved</p>
              <p className="break-words text-[clamp(2.25rem,10vw,4rem)] font-black leading-none tracking-tighter" style={{ color: 'var(--color-text-primary)' }}>
                ${totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 break-words text-[15px] font-bold opacity-60">
                Target: ${totalTarget.toLocaleString()}
              </p>
            </div>

            <div className="h-3 rounded-full bg-white/10 overflow-hidden shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(overallPct, 100)}%` }}
                transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.2 }}
                style={{ boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}
              />
            </div>
          </div>
          {/* Decorative background circle */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
        </motion.div>
      )}

      <SavingsCoach onPlanSaved={() => { void loadGoals() }} />

      {/* Goals list */}
      <div className="space-y-5">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 ml-1">Active Goals</p>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="skeleton h-44 rounded-[28px]" />
            ))}
          </div>
        ) : activeGoals.length === 0 && completedGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-[var(--color-card-base)] rounded-[32px] border border-dashed border-[var(--color-border-base)]">
            <div className="w-20 h-20 rounded-full bg-[var(--color-card-elevated-base)] flex items-center justify-center text-4xl mb-6">🎯</div>
            <h3 className="text-xl font-black mb-2">No active goals</h3>
            <p className="text-sm font-medium opacity-50 max-w-[240px] leading-relaxed mb-8">
              Start your financial journey by setting your first savings target.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-4 rounded-2xl bg-[var(--color-accent-base)] text-white font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
            >
              Set a Goal
            </button>
          </div>
        ) : activeGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-[var(--color-card-base)] rounded-[32px] border border-dashed border-[var(--color-border-base)]">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-black mb-1">All goals achieved!</h3>
            <p className="text-sm font-medium opacity-50">Set a new goal to keep saving.</p>
          </div>
        ) : (
          <AnimatePresence>
            {activeGoals.map(goal => {
              const pct = goal.target_usd > 0 ? Math.min((goal.current_usd / goal.target_usd) * 100, 100) : 0
              const remaining = Math.max(goal.target_usd - goal.current_usd, 0)
              const days = daysUntil(goal.deadline)
              const done = pct >= 100
              const isOverdue = !done && days !== null && days < 0
              const dailyNeeded = days && days > 0 ? (remaining / days) : null
              const hasMonthlyPlan = goal.auto_monthly_usd > 0
              const monthlyPlanState = goal.last_contribution_month === currentMonth
                ? 'confirmed'
                : goal.skipped_month === currentMonth
                  ? 'skipped'
                  : currentDay >= goal.reminder_day
                    ? 'due'
                    : 'upcoming'

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative overflow-hidden rounded-[28px] p-5 shadow-sm transition-all sm:p-6"
                  style={{
                    backgroundColor: 'var(--color-card-base)',
                    border: isOverdue ? '1.5px solid rgba(239,68,68,0.4)' : '1px solid var(--color-border-base)',
                  }}
                >
                  {/* Goal header */}
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-lg"
                        style={{
                          backgroundColor: `${goal.color}15`,
                          border: `1px solid ${goal.color}30`
                        }}
                      >
                        {goal.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="min-w-0 truncate text-lg font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{goal.name}</h3>
                          {done && <CheckCircle2 className="w-5 h-5" style={{ color: goal.color }} />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                           {days !== null && (
                             <div className="flex items-center gap-1">
                               <Calendar className="w-3.5 h-3.5 opacity-40" />
                               <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: days < 14 ? 'var(--color-warning-base)' : 'var(--color-text-secondary)' }}>
                                 {days > 0 ? `${days}d left` : days === 0 ? 'Due today' : 'Overdue'}
                               </span>
                             </div>
                           )}
                           {goal.note && (
                             <span className="max-w-full truncate text-[11px] font-medium opacity-40 sm:max-w-[120px]">• {goal.note}</span>
                           )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2 self-end opacity-100 transition-opacity md:self-auto md:opacity-0 md:group-hover:opacity-100">
                      <button
                        onClick={() => setEditGoal(goal)}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-card-elevated-base)] active:scale-90 transition-all"
                      >
                        <Pencil className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      </button>
                      <button
                        onClick={() => deleteGoal(goal)}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-card-elevated-base)] active:scale-90 transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Purpose / motivation */}
                  {goal.purpose && (
                    <div
                      className="mb-5 flex items-start gap-2.5 rounded-2xl px-4 py-3"
                      style={{ backgroundColor: `${goal.color}10`, borderLeft: `3px solid ${goal.color}50` }}
                    >
                      <span className="text-base mt-0.5 shrink-0">💬</span>
                      <p className="text-[13px] font-semibold italic leading-snug opacity-80" style={{ color: 'var(--color-text-primary)' }}>
                        {goal.purpose}
                      </p>
                    </div>
                  )}

                  {/* Progress Section */}
                  <div className="space-y-2 mb-6">
                    <div className="flex flex-col gap-2 min-[431px]:flex-row min-[431px]:items-end min-[431px]:justify-between">
                       <p className="min-w-0 break-words text-[clamp(1.9rem,8vw,2.5rem)] font-black leading-none" style={{ color: 'var(--color-text-primary)' }}>
                         ${goal.current_usd.toLocaleString()}
                         <span className="ml-1.5 text-sm font-bold opacity-40">/ ${goal.target_usd.toLocaleString()}</span>
                       </p>
                       <p className="shrink-0 text-sm font-black" style={{ color: goal.color }}>{pct.toFixed(0)}%</p>
                    </div>
                    <div className="h-2.5 rounded-full bg-[var(--color-card-elevated-base)] overflow-hidden shadow-inner">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: goal.color,
                          boxShadow: `0 0 15px ${goal.color}40`
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', damping: 15, stiffness: 80 }}
                      />
                    </div>
                  </div>

                  {hasMonthlyPlan && (
                    <div
                      className="mb-5 rounded-2xl border p-4"
                      style={{
                        backgroundColor: monthlyPlanState === 'due' ? `${goal.color}10` : 'var(--color-card-elevated-base)',
                        borderColor: monthlyPlanState === 'due' ? `${goal.color}35` : 'var(--color-border-base)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: monthlyPlanState === 'due' ? `${goal.color}20` : 'var(--color-card-base)' }}
                        >
                          {monthlyPlanState === 'confirmed'
                            ? <CheckCircle2 size={18} className="text-green-400" />
                            : monthlyPlanState === 'skipped'
                              ? <SkipForward size={18} className="opacity-50" />
                              : <Bell size={18} style={{ color: monthlyPlanState === 'due' ? goal.color : undefined }} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black uppercase tracking-widest opacity-50">Monthly plan</p>
                          <p className="mt-0.5 text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>
                            ${formatNumber(goal.auto_monthly_usd)}
                            <span className="ml-1.5 text-[11px] font-bold opacity-45">reminder day {goal.reminder_day}</span>
                          </p>
                          <p className="mt-1 text-[11px] font-semibold opacity-55">
                            {monthlyPlanState === 'confirmed' && 'Confirmed for this month'}
                            {monthlyPlanState === 'skipped' && 'Skipped for this month'}
                            {monthlyPlanState === 'upcoming' && `Reminder in ${goal.reminder_day - currentDay} day${goal.reminder_day - currentDay === 1 ? '' : 's'}`}
                            {monthlyPlanState === 'due' && 'Ready when your real transfer is complete'}
                          </p>
                        </div>
                      </div>

                      {monthlyPlanState === 'due' && (
                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                          <button
                            onClick={() => { haptic('light'); setDepositGoal({ goal, mode: 'planned' }) }}
                            className="rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
                            style={{ backgroundColor: goal.color }}
                          >
                            Confirm deposit
                          </button>
                          <button
                            onClick={() => skipMonth(goal)}
                            disabled={skippingGoalId === goal.id}
                            className="rounded-xl border border-[var(--color-border-base)] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider opacity-60 transition-all active:scale-95 disabled:opacity-30"
                          >
                            {skippingGoalId === goal.id ? 'Skipping…' : 'Skip'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pro Stats Footer */}
                  <div className="flex flex-col gap-4 border-t border-[var(--color-border-base)] pt-4 min-[431px]:flex-row min-[431px]:items-center min-[431px]:justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">
                        {isOverdue ? 'Status' : 'Needed Daily'}
                      </span>
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-400">
                          ⚠ Overdue
                        </span>
                      ) : (
                        <p className="text-[13px] font-black" style={{ color: dailyNeeded ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                          {dailyNeeded ? `$${dailyNeeded.toFixed(2)}` : '--'}
                        </p>
                      )}
                    </div>
                    {!done ? (
                      <button
                        onClick={() => { haptic('light'); setDepositGoal({ goal, mode: 'manual' }) }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 min-[431px]:w-auto"
                        style={{
                          backgroundColor: goal.color,
                          boxShadow: `0 8px 16px ${goal.color}30`
                        }}
                      >
                        <ArrowUpRight size={14} strokeWidth={3} />
                        Add funds
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-green-400">
                         <CheckCircle2 size={16} strokeWidth={3} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Achieved</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {/* Completed Goals */}
        {!loading && completedGoals.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowCompleted(p => !p)}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] opacity-50 hover:opacity-80 transition-opacity ml-1 mb-3"
            >
              <CheckCircle2 size={13} className="text-green-400" />
              {completedGoals.length} Completed
              <span className="opacity-60">{showCompleted ? '▲' : '▼'}</span>
            </button>
            <AnimatePresence>
              {showCompleted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {completedGoals.map(goal => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-4 p-4 rounded-[20px] border opacity-70"
                      style={{ backgroundColor: 'var(--color-card-base)', borderColor: `${goal.color}30` }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${goal.color}15` }}>
                        {goal.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: 'var(--color-text-primary)' }}>{goal.name}</p>
                        <p className="text-[11px] font-bold" style={{ color: goal.color }}>${goal.target_usd.toLocaleString()} saved</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" strokeWidth={2.5} />
                      <button
                        onClick={() => deleteGoal(goal)}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-card-elevated-base)] active:scale-90 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Goal Form Bottom Sheet */}
      <BottomSheet
        isOpen={showForm || !!editGoal}
        onClose={() => { setShowForm(false); setEditGoal(null) }}
        title={editGoal ? "Modify Goal" : "New Savings Target"}
      >
        <GoalForm
          initial={editGoal || undefined}
          onSave={(data) => {
            if (editGoal) {
              updateGoal(editGoal.id, data, () => setEditGoal(null))
            } else {
              createGoal(data, () => setShowForm(false))
            }
          }}
          loading={saving}
        />
      </BottomSheet>

      {/* Add deposit sheet */}
      <AnimatePresence>
        {celebrating && (
          <ConfettiCelebration
            goalName={celebrating.name}
            goalColor={celebrating.color}
            onDone={() => setCelebrating(null)}
          />
        )}
      </AnimatePresence>

      {depositGoal && (
        <AddDepositSheet
          goal={depositGoal.goal}
          mode={depositGoal.mode}
          isOpen={!!depositGoal}
          onClose={() => setDepositGoal(null)}
          onSuccess={(newTotal, mode) => applyContribution(depositGoal.goal.id, newTotal, mode)}
          onGoalComplete={() => setCelebrating({ name: depositGoal.goal.name, color: depositGoal.goal.color })}
        />
      )}
    </div>
  )
}
