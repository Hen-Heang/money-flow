'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Target, Pencil, Trash2, Calendar, ArrowUpRight, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { haptic } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { PRESET_ICONS, PRESET_COLORS } from '@/shared/presets'
import BottomSheet from '@/components/ui/BottomSheet'
import NumericKeypad from '@/components/ui/NumericKeypad'
import { createPortal } from 'react-dom'

interface SavingsGoal {
  id: string
  name: string
  icon: string
  color: string
  target_usd: number
  current_usd: number
  deadline: string | null
  note: string | null
  purpose: string | null
  auto_monthly_usd: number
  last_auto_month: string | null
}

const CONFETTI_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#fbbf24']

// Generated once at module load — safe from render purity rules
const CONFETTI_PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  x: (Math.random() - 0.5) * 320,
  y: -(Math.random() * 480 + 120),
  rotate: Math.random() * 720 - 360,
  scale: Math.random() * 0.6 + 0.4,
  delay: Math.random() * 0.3,
}))

function ConfettiCelebration({ goalName, goalColor, onDone }: { goalName: string; goalColor: string; onDone: () => void }) {
  const particles = CONFETTI_PARTICLES

  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
    >
      {/* Burst origin */}
      <div className="relative">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: p.color, top: 0, left: 0 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: p.scale }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: p.scale * 0.5 }}
            transition={{ duration: 1.6, delay: p.delay, ease: [0.2, 0.8, 0.4, 1] }}
          />
        ))}

        {/* Central badge */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-3 px-8 py-6 rounded-3xl shadow-2xl pointer-events-auto"
          style={{ backgroundColor: goalColor, boxShadow: `0 24px 60px ${goalColor}60` }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={onDone}
        >
          <motion.span
            className="text-5xl"
            animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            🎉
          </motion.span>
          <div className="text-center text-white">
            <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Goal Achieved!</p>
            <p className="text-lg font-black leading-tight">{goalName}</p>
          </div>
          <p className="text-[10px] text-white/50 font-bold">Tap to continue</p>
        </motion.div>
      </div>
    </motion.div>
  )
}



function GoalForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<SavingsGoal>
  onSave: (data: Omit<SavingsGoal, 'id'>) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '💰')
  const [color, setColor] = useState(initial?.color ?? '#3b82f6')
  const [targetUsd, setTargetUsd] = useState(initial?.target_usd?.toString() ?? '')
  const [currentUsd, setCurrentUsd] = useState(initial?.current_usd?.toString() ?? '0')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [purpose, setPurpose] = useState(initial?.purpose ?? '')
  const [autoMonthly, setAutoMonthly] = useState(initial?.auto_monthly_usd?.toString() ?? '0')

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-card-elevated-base)',
    border: '1px solid var(--color-border-base)',
    color: 'var(--color-text-primary)',
    fontSize: '16px',
    borderRadius: '16px',
    padding: '16px',
    width: '100%',
    outline: 'none',
  }

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    const target = parseFloat(targetUsd)
    if (isNaN(target) || target <= 0) { toast.error('Invalid target amount'); return }
    const current = parseFloat(currentUsd) || 0
    const monthly = parseFloat(autoMonthly) || 0
    onSave({
      name: name.trim(),
      icon,
      color,
      target_usd: target,
      current_usd: current,
      deadline: deadline || null,
      note: note.trim() || null,
      purpose: purpose.trim() || null,
      auto_monthly_usd: Math.max(monthly, 0),
      last_auto_month: initial?.last_auto_month ?? null,
    })
  }

  return (
    <div className="px-5 pb-6 space-y-6">
      {/* Icon & Color Selection */}
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest mb-3 opacity-60">Visual Style</p>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_ICONS.map(i => (
              <button
                key={i}
                type="button"
                onClick={() => { haptic('light'); setIcon(i) }}
                className="w-11 h-11 rounded-2xl text-2xl flex items-center justify-center transition-all active:scale-90"
                style={{
                  backgroundColor: icon === i ? color : 'var(--color-card-elevated-base)',
                  boxShadow: icon === i ? `0 8px 20px ${color}40` : 'none',
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { haptic('light'); setColor(c) }}
              className="w-9 h-9 rounded-full transition-all active:scale-90"
              style={{
                backgroundColor: c,
                border: color === c ? '3px solid white' : 'none',
                boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Goal Details</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="What are you saving for?"
          className="font-bold"
          style={inputStyle}
        />

        <div>
          <p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">Your Why</p>
          <textarea
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="Why does this matter to you? e.g. 'Dream vacation with my family'"
            rows={2}
            className="font-medium"
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg opacity-40">$</span>
            <input
              value={targetUsd}
              onChange={e => setTargetUsd(e.target.value)}
              inputMode="decimal"
              placeholder="Target"
              className="font-black"
              style={{ ...inputStyle, paddingLeft: '32px' }}
            />
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg opacity-40">$</span>
            <input
              value={currentUsd}
              onChange={e => setCurrentUsd(e.target.value)}
              inputMode="decimal"
              placeholder="Saved"
              className="font-black"
              style={{ ...inputStyle, paddingLeft: '32px' }}
            />
          </div>
        </div>

        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
          <input
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            type="date"
            className="font-bold"
            style={{ ...inputStyle, paddingLeft: '44px' }}
          />
        </div>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note"
          rows={2}
          className="font-medium"
          style={{ ...inputStyle, resize: 'none' }}
        />

        <div>
          <p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">Auto-Deposit on App Open</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg opacity-40">$</span>
            <input
              value={autoMonthly}
              onChange={e => setAutoMonthly(e.target.value)}
              inputMode="decimal"
              placeholder="0 = disabled"
              className="font-black"
              style={{ ...inputStyle, paddingLeft: '32px' }}
            />
          </div>
          <p className="text-[11px] font-medium opacity-40 mt-1.5 ml-1">
            Auto-deposited once per month when you open the app
          </p>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-4 rounded-button font-black uppercase tracking-widest text-white disabled:opacity-50 shadow-xl transition-all active:scale-95"
        style={{ backgroundColor: color, boxShadow: `0 12px 24px ${color}30` }}
      >
        {loading ? 'Processing...' : initial ? 'Update Goal' : 'Launch Goal'}
      </button>
    </div>
  )
}

function AddDepositSheet({
  goal,
  isOpen,
  onClose,
  onSuccess,
  onGoalComplete,
}: {
  goal: SavingsGoal
  isOpen: boolean
  onClose: () => void
  onSuccess: (newTotal: number) => void
  onGoalComplete?: () => void
}) {
  const [amount, setAmount] = useState('')
  const [showKeypad, setShowKeypad] = useState(true)
  const [saving, setSaving] = useState(false)
  const isMobile = useIsMobile()
  const supabase = useSupabaseClient()

  const handleSave = async () => {
    const deposit = parseFloat(amount.replace(/,/g, ''))
    if (isNaN(deposit) || deposit <= 0) { toast.error('Invalid amount'); return }
    setSaving(true)
    const newTotal = goal.current_usd + deposit
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_usd: newTotal, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    haptic('medium')
    const achieved = newTotal >= goal.target_usd
    if (achieved) {
      haptic('heavy')
      onGoalComplete?.()
    } else {
      toast.success(`+$${deposit.toFixed(2)} added to ${goal.name}!`)
    }
    setAmount('')
    onSuccess(newTotal)
    onClose()
  }

  const content = (
    <div className="px-5 pb-4 space-y-6">
      <div
        className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ backgroundColor: `${goal.color}12`, border: `1.5px solid ${goal.color}30` }}
      >
        <span className="text-4xl">{goal.icon}</span>
        <div>
          <p className="text-lg font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{goal.name}</p>
          <p className="text-[13px] font-bold opacity-60">
            Progress: ${goal.current_usd.toLocaleString()} / ${goal.target_usd.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-2xl opacity-30">$</span>
        <input
          value={amount}
          readOnly={isMobile}
          onChange={e => !isMobile && setAmount(e.target.value)}
          onFocus={() => isMobile && setShowKeypad(true)}
          placeholder="0.00"
          className="w-full bg-[var(--color-card-elevated-base)] border-2 font-black text-right pr-6 py-5 rounded-2xl text-3xl outline-none transition-all"
          style={{ 
            borderColor: showKeypad ? goal.color : 'var(--color-border-base)',
            paddingLeft: '48px',
            boxShadow: showKeypad ? `0 0 20px ${goal.color}15` : 'none'
          }}
        />
      </div>

      {!isMobile && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-button font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-50"
          style={{ backgroundColor: goal.color, boxShadow: `0 12px 24px ${goal.color}30` }}
        >
          {saving ? 'Saving...' : 'Confirm Deposit'}
        </button>
      )}
    </div>
  )

  if (!isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Savings">
        {content}
      </BottomSheet>
    )
  }

  const mobilePanel = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="relative bg-[var(--color-bg)] rounded-t-[32px] overflow-hidden flex flex-col"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-[var(--color-border-base)]" />
            </div>
            <div className="px-5 py-4 flex justify-between items-center">
              <h2 className="text-xl font-black">Add Deposit</h2>
              <button onClick={onClose} className="p-2 rounded-full bg-[var(--color-card-elevated-base)]">
                <X size={20} />
              </button>
            </div>
            {content}
            <div className="mt-auto">
              <AnimatePresence mode="wait">
                {showKeypad ? (
                  <motion.div
                    key="keypad"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  >
                    <NumericKeypad
                      showMath={false}
                      onInput={(val) => setAmount(prev => prev + val)}
                      onDelete={() => setAmount(prev => prev.slice(0, -1))}
                      onDone={() => setShowKeypad(false)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="px-5 py-6 glass-ios border-t border-[var(--color-border-base)]"
                    style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
                  >
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full py-4 rounded-button font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-50 shadow-xl"
                      style={{ backgroundColor: goal.color, boxShadow: `0 12px 24px ${goal.color}30` }}
                    >
                      Confirm ${parseFloat(amount || '0').toLocaleString()} Deposit
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(mobilePanel, document.body) : null
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null)
  const [saving, setSaving] = useState(false)
  const [todayMs] = useState(() => Date.now())
  const [celebrating, setCelebrating] = useState<{ name: string; color: string } | null>(null)
  const supabase = useSupabaseClient()

  const loadGoals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    const loaded = (data as SavingsGoal[]) || []
    setGoals(loaded)
    setLoading(false)
    return loaded
  }, [supabase])

  useEffect(() => {
    loadGoals().then(loaded => { if (loaded) applyAutoDeposits(loaded) })

    // Refresh when returning to the tab
    const handleFocus = () => loadGoals()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGoals])

  const applyAutoDeposits = useCallback(async (loadedGoals: SavingsGoal[]) => {
    const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
    const due = loadedGoals.filter(
      g => g.auto_monthly_usd > 0 && g.last_auto_month !== currentMonth && g.current_usd < g.target_usd
    )
    if (due.length === 0) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let applied = 0
    for (const goal of due) {
      const newTotal = Math.min(goal.current_usd + goal.auto_monthly_usd, goal.target_usd)
      const { error } = await supabase
        .from('savings_goals')
        .update({ current_usd: newTotal, last_auto_month: currentMonth, updated_at: new Date().toISOString() })
        .eq('id', goal.id)
      if (!error) applied++
    }

    if (applied > 0) {
      toast.success(`Auto-deposited to ${applied} goal${applied > 1 ? 's' : ''}`)
      loadGoals()
    }
  }, [supabase, loadGoals])

  const handleCreate = async (data: Omit<SavingsGoal, 'id'>) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase.from('savings_goals').insert({ ...data, user_id: user.id })
    setSaving(false)
    if (error) { toast.error('Failed to create goal'); return }
    haptic('medium')
    toast.success('Goal activated!')
    setShowForm(false)
    loadGoals()
  }

  const handleUpdate = async (data: Omit<SavingsGoal, 'id'>) => {
    if (!editGoal) return
    setSaving(true)
    const { error } = await supabase
      .from('savings_goals')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', editGoal.id)
    setSaving(false)
    if (error) { toast.error('Failed to update'); return }
    haptic('medium')
    toast.success('Goal updated!')
    setEditGoal(null)
    loadGoals()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    haptic('medium')
    toast.success('Goal removed')
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const totalSaved = goals.reduce((s, g) => s + g.current_usd, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_usd, 0)
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

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

      {/* Goals list */}
      <div className="space-y-5">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 ml-1">Individual Goals</p>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="skeleton h-44 rounded-[28px]" />
            ))}
          </div>
        ) : goals.length === 0 ? (
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
        ) : (
          <AnimatePresence>
            {goals.map(goal => {
              const pct = goal.target_usd > 0 ? Math.min((goal.current_usd / goal.target_usd) * 100, 100) : 0
              const remaining = Math.max(goal.target_usd - goal.current_usd, 0)
              const days = daysUntil(goal.deadline)
              const done = pct >= 100
              
              // Daily contribution calculation
              const dailyNeeded = days && days > 0 ? (remaining / days) : null

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative overflow-hidden rounded-[28px] border border-[var(--color-border-base)] p-5 shadow-sm transition-all active:border-white/20 sm:p-6"
                  style={{ backgroundColor: 'var(--color-card-base)' }}
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
                        onClick={() => { if(confirm('Delete goal?')) handleDelete(goal.id) }}
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

                  {/* Pro Stats Footer */}
                  <div className="flex flex-col gap-4 border-t border-[var(--color-border-base)] pt-4 min-[431px]:flex-row min-[431px]:items-center min-[431px]:justify-between">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">Needed Daily</span>
                       <p className="text-[13px] font-black" style={{ color: dailyNeeded ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                         {dailyNeeded ? `$${dailyNeeded.toFixed(2)}` : '--'}
                       </p>
                    </div>
                    {!done ? (
                      <button
                        onClick={() => { haptic('light'); setDepositGoal(goal) }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 min-[431px]:w-auto"
                        style={{ 
                          backgroundColor: goal.color,
                          boxShadow: `0 8px 16px ${goal.color}30`
                        }}
                      >
                        <ArrowUpRight size={14} strokeWidth={3} />
                        Deposit
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
      </div>

      {/* Goal Form Bottom Sheet */}
      <BottomSheet
        isOpen={showForm || !!editGoal}
        onClose={() => { setShowForm(false); setEditGoal(null) }}
        title={editGoal ? "Modify Goal" : "New Savings Target"}
      >
        <GoalForm
          initial={editGoal || undefined}
          onSave={editGoal ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditGoal(null) }}
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
          goal={depositGoal}
          isOpen={!!depositGoal}
          onClose={() => setDepositGoal(null)}
          onSuccess={(newTotal) => {
            setGoals(prev => prev.map(g => g.id === depositGoal.id ? { ...g, current_usd: newTotal } : g))
          }}
          onGoalComplete={() => setCelebrating({ name: depositGoal.name, color: depositGoal.color })}
        />
      )}
    </div>
  )
}
