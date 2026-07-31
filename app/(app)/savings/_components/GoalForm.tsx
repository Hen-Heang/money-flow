'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Calendar } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { PRESET_ICONS, PRESET_COLORS } from '@/shared/presets'
import type { SavingsGoal, SavingsGoalInput } from '../_types'

export function GoalForm({
  initial,
  onSave,
  loading,
}: {
  initial?: Partial<SavingsGoal>
  onSave: (data: SavingsGoalInput) => void
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
  const [reminderDay, setReminderDay] = useState(initial?.reminder_day?.toString() ?? '1')

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
    const parsedReminderDay = Number.parseInt(reminderDay, 10)
    const safeReminderDay = Number.isNaN(parsedReminderDay) ? 1 : Math.min(Math.max(parsedReminderDay, 1), 28)
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
      reminder_day: safeReminderDay,
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

        <div className="space-y-3 rounded-2xl border border-[var(--color-border-base)] p-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Monthly Savings Plan</p>
            <p className="mt-1 text-[12px] font-medium opacity-50">Set a reminder. Your balance changes only after you confirm.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-50">Planned amount</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg opacity-40">$</span>
                <input
                  value={autoMonthly}
                  onChange={e => setAutoMonthly(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="font-black"
                  style={{ ...inputStyle, paddingLeft: '32px' }}
                />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-50">Reminder day</span>
              <input
                value={reminderDay}
                onChange={e => setReminderDay(e.target.value)}
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                className="font-black text-center"
                style={inputStyle}
              />
            </label>
          </div>
          <p className="text-[11px] font-medium opacity-40">Choose day 1–28 so the reminder works every month.</p>
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
