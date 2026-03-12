'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Target, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { haptic } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'

interface SavingsGoal {
  id: string
  name: string
  icon: string
  color: string
  target_usd: number
  current_usd: number
  deadline: string | null
  note: string | null
}

const PRESET_ICONS = ['💰', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🏖️', '🏋️', '🎮', '📈']
const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

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

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-card-elevated-base)',
    border: '1px solid var(--color-border-base)',
    color: 'var(--color-text-primary)',
    fontSize: '16px',
    borderRadius: '12px',
    padding: '14px 16px',
    width: '100%',
    outline: 'none',
  }

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    const target = parseFloat(targetUsd)
    if (isNaN(target) || target <= 0) { toast.error('Invalid target amount'); return }
    const current = parseFloat(currentUsd) || 0
    onSave({
      name: name.trim(),
      icon,
      color,
      target_usd: target,
      current_usd: current,
      deadline: deadline || null,
      note: note.trim() || null,
    })
  }

  return (
    <div className="px-4 pb-2 space-y-4">
      {/* Icon picker */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Icon</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_ICONS.map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all"
              style={{
                backgroundColor: icon === i ? color : 'var(--color-card-elevated-base)',
                border: `2px solid ${icon === i ? color : 'transparent'}`,
              }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Color</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>

      {/* Name */}
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Goal name (e.g. Emergency Fund)"
        style={inputStyle}
      />

      {/* Target */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>$</span>
        <input
          value={targetUsd}
          onChange={e => setTargetUsd(e.target.value)}
          inputMode="decimal"
          placeholder="Target amount (USD)"
          style={{ ...inputStyle, paddingLeft: '32px' }}
        />
      </div>

      {/* Current saved */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>$</span>
        <input
          value={currentUsd}
          onChange={e => setCurrentUsd(e.target.value)}
          inputMode="decimal"
          placeholder="Already saved (USD)"
          style={{ ...inputStyle, paddingLeft: '32px' }}
        />
      </div>

      {/* Deadline */}
      <input
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
        type="date"
        style={inputStyle}
      />

      {/* Note */}
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)"
        style={inputStyle}
      />

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-button font-semibold text-sm"
          style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-3.5 rounded-button font-semibold text-sm text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent-base)' }}
        >
          {loading ? 'Saving...' : 'Save Goal'}
        </button>
      </div>
    </div>
  )
}

function AddDepositSheet({
  goal,
  isOpen,
  onClose,
  onSuccess,
}: {
  goal: SavingsGoal
  isOpen: boolean
  onClose: () => void
  onSuccess: (newTotal: number) => void
}) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const handleSave = async () => {
    const deposit = parseFloat(amount)
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
    toast.success(`+$${deposit.toFixed(2)} added!`)
    setAmount('')
    onSuccess(newTotal)
    onClose()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Add to ${goal.name}`}>
      <div className="px-4 pb-4 space-y-4">
        <div
          className="flex items-center gap-3 p-3 rounded-2xl"
          style={{ backgroundColor: `${goal.color}18`, border: `1px solid ${goal.color}40` }}
        >
          <span className="text-3xl">{goal.icon}</span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{goal.name}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              ${goal.current_usd.toFixed(2)} / ${goal.target_usd.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xl" style={{ color: 'var(--color-text-secondary)' }}>$</span>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            style={{
              backgroundColor: 'var(--color-card-elevated-base)',
              border: '1px solid var(--color-border-base)',
              color: 'var(--color-text-primary)',
              fontSize: 'clamp(22px, 6vw, 28px)',
              fontWeight: 'bold',
              borderRadius: '12px',
              padding: '16px 16px 16px 40px',
              width: '100%',
              outline: 'none',
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-button font-semibold text-base text-white active:scale-95 transition-transform disabled:opacity-50"
          style={{ backgroundColor: goal.color }}
        >
          {saving ? 'Saving...' : 'Add Deposit'}
        </button>
      </div>
    </BottomSheet>
  )
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null)
  const [saving, setSaving] = useState(false)
  const [todayMs] = useState(() => Date.now())
  const supabase = createClient()

  const loadGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setGoals((data as SavingsGoal[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    const initialLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (!active) return
      setGoals((data as SavingsGoal[]) || [])
      setLoading(false)
    }

    void initialLoad()

    return () => {
      active = false
    }
  }, [supabase])

  const handleCreate = async (data: Omit<SavingsGoal, 'id'>) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase.from('savings_goals').insert({ ...data, user_id: user.id })
    setSaving(false)
    if (error) { toast.error('Failed to create goal'); return }
    haptic('medium')
    toast.success('Goal created!')
    setShowForm(false)
    setLoading(true)
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
    if (error) { toast.error('Failed to update goal'); return }
    haptic('medium')
    toast.success('Goal updated!')
    setEditGoal(null)
    setLoading(true)
    loadGoals()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    haptic('medium')
    toast.success('Goal deleted')
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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Savings</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--color-accent-base)' }}
        >
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </div>

      {/* Overall summary */}
      {goals.length > 0 && (
        <div
          className="glass-balance rounded-2xl p-5 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Total Savings Progress</p>
          </div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                ${totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                of ${totalTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} target
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-accent-base)' }} />
              <p className="text-xl font-bold" style={{ color: 'var(--color-accent-base)' }}>
                {overallPct.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: 'var(--color-accent-base)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(overallPct, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>No savings goals yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Set a goal and track your progress toward it
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-button font-semibold text-white"
            style={{ backgroundColor: 'var(--color-accent-base)' }}
          >
            <Plus className="w-4 h-4" />
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {goals.map(goal => {
              const pct = goal.target_usd > 0 ? Math.min((goal.current_usd / goal.target_usd) * 100, 100) : 0
              const remaining = Math.max(goal.target_usd - goal.current_usd, 0)
              const days = daysUntil(goal.deadline)
              const done = pct >= 100

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor: 'var(--color-card-base)',
                    border: `1px solid ${done ? goal.color : 'var(--color-border-base)'}`,
                    boxShadow: done ? `0 0 0 1px ${goal.color}40` : undefined,
                  }}
                >
                  {/* Goal header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                        style={{ backgroundColor: `${goal.color}20` }}
                      >
                        {goal.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{goal.name}</p>
                          {done && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: goal.color }}>
                              Done!
                            </span>
                          )}
                        </div>
                        {goal.note && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{goal.note}</p>
                        )}
                        {days !== null && (
                          <p className="text-xs mt-0.5" style={{ color: days < 30 ? 'var(--color-warning-base)' : 'var(--color-text-secondary)' }}>
                            {days > 0 ? `${days}d left` : days === 0 ? 'Due today' : 'Overdue'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditGoal(goal)}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
                      >
                        <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--color-expense-base)' }} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: goal.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold" style={{ color: goal.color }}>
                        ${goal.current_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                        / ${goal.target_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        {pct.toFixed(0)}%
                      </span>
                      {!done && (
                        <button
                          onClick={() => setDepositGoal(goal)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white active:scale-95 transition-transform"
                          style={{ backgroundColor: goal.color }}
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>

                  {!done && remaining > 0 && (
                    <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                      ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining
                    </p>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* New goal bottom sheet */}
      <BottomSheet
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="New Savings Goal"
        footer={null}
      >
        <GoalForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={saving}
        />
      </BottomSheet>

      {/* Edit goal bottom sheet */}
      <BottomSheet
        isOpen={!!editGoal}
        onClose={() => setEditGoal(null)}
        title="Edit Goal"
        footer={null}
      >
        {editGoal && (
          <GoalForm
            initial={editGoal}
            onSave={handleUpdate}
            onCancel={() => setEditGoal(null)}
            loading={saving}
          />
        )}
      </BottomSheet>

      {/* Add deposit sheet */}
      {depositGoal && (
        <AddDepositSheet
          goal={depositGoal}
          isOpen={!!depositGoal}
          onClose={() => setDepositGoal(null)}
          onSuccess={(newTotal) => {
            setGoals(prev => prev.map(g => g.id === depositGoal.id ? { ...g, current_usd: newTotal } : g))
          }}
        />
      )}
    </div>
  )
}
