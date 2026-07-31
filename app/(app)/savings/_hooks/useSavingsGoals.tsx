'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { haptic } from '@/lib/utils'
import { getKstMonthAndDay } from '../_lib/kst'
import type { SavingsGoal, SavingsGoalInput } from '../_types'

export function useSavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skippingGoalId, setSkippingGoalId] = useState<string | null>(null)
  const supabase = useSupabaseClient()

  const loadGoals = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('savings_goals')
      .select('id, name, icon, color, target_usd, current_usd, deadline, note, purpose, auto_monthly_usd, reminder_day, last_reminder_month, last_contribution_month, skipped_month')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    const loaded = (data as SavingsGoal[]) || []
    setGoals(loaded)
    setLoading(false)
    return loaded
  }, [supabase])

  useEffect(() => {
    // Initial load and focus refresh intentionally synchronize remote data into local UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGoals()

    // Refresh when returning to the tab
    const handleFocus = () => loadGoals()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadGoals])

  const createGoal = async (data: SavingsGoalInput, onDone: () => void) => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setSaving(false); return }
    const { error } = await supabase.from('savings_goals').insert({ ...data, user_id: user.id })
    setSaving(false)
    if (error) { toast.error('Failed to create goal'); return }
    haptic('medium')
    toast.success('Goal activated!')
    onDone()
    loadGoals()
  }

  const updateGoal = async (goalId: string, data: SavingsGoalInput, onDone: () => void) => {
    setSaving(true)
    const { error } = await supabase
      .from('savings_goals')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', goalId)
    setSaving(false)
    if (error) { toast.error('Failed to update'); return }
    haptic('medium')
    toast.success('Goal updated!')
    onDone()
    loadGoals()
  }

  const skipMonth = async (goal: SavingsGoal) => {
    const { month } = getKstMonthAndDay()
    setSkippingGoalId(goal.id)
    const { error } = await supabase
      .from('savings_goals')
      .update({ skipped_month: month, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
    setSkippingGoalId(null)
    if (error) {
      toast.error('Failed to skip this month')
      return
    }
    haptic('light')
    setGoals(prev => prev.map(item => item.id === goal.id ? { ...item, skipped_month: month } : item))
    toast.success('Monthly reminder skipped')
  }

  const deleteGoal = (goal: SavingsGoal) => {
    haptic('medium')
    setGoals(prev => prev.filter(g => g.id !== goal.id))
    let undone = false
    toast.custom(
      (id) => (
        <span className="flex items-center gap-3 text-sm font-medium px-4 py-3 rounded-xl bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] shadow-xl">
          Goal removed
          <button
            className="font-black text-blue-400 underline-offset-2 hover:underline"
            onClick={() => {
              undone = true
              setGoals(prev => [...prev, goal].sort((a, b) => a.id.localeCompare(b.id)))
              toast.dismiss(id)
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 }
    )
    setTimeout(async () => {
      if (undone) return
      const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id)
      if (error) {
        toast.error('Failed to delete')
        setGoals(prev => [...prev, goal])
      }
    }, 5100)
  }

  const applyContribution = (goalId: string, newTotal: number, mode: 'manual' | 'planned') => {
    const { month } = getKstMonthAndDay()
    setGoals(prev => prev.map(g => g.id === goalId ? {
      ...g,
      current_usd: newTotal,
      last_contribution_month: mode === 'planned' ? month : g.last_contribution_month,
      skipped_month: mode === 'planned' ? null : g.skipped_month,
    } : g))
  }

  const activeGoals = useMemo(() => goals.filter(g => g.current_usd < g.target_usd), [goals])
  const completedGoals = useMemo(() => goals.filter(g => g.current_usd >= g.target_usd), [goals])

  return {
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
  }
}
