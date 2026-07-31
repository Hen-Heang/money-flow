'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { haptic, formatNumber } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import BottomSheet from '@/components/ui/BottomSheet'
import NumericKeypad from '@/components/ui/NumericKeypad'
import type { SavingsGoal, ContributionMode, SavingsContributionResult } from '../_types'

export function AddDepositSheet({
  goal,
  mode,
  isOpen,
  onClose,
  onSuccess,
  onGoalComplete,
}: {
  goal: SavingsGoal
  mode: ContributionMode
  isOpen: boolean
  onClose: () => void
  onSuccess: (newTotal: number, mode: ContributionMode) => void
  onGoalComplete?: () => void
}) {
  const [amount, setAmount] = useState(mode === 'planned' ? String(goal.auto_monthly_usd) : '')
  const [requestId] = useState(() => crypto.randomUUID())
  const [showKeypad, setShowKeypad] = useState(true)
  const [saving, setSaving] = useState(false)
  const isMobile = useIsMobile()
  const supabase = useSupabaseClient()

  const handleSave = async () => {
    const deposit = parseFloat(amount.replace(/,/g, ''))
    if (isNaN(deposit) || deposit <= 0) { toast.error('Invalid amount'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('record_savings_contribution', {
      p_goal_id: goal.id,
      p_amount_usd: deposit,
      p_source: mode,
      p_request_id: requestId,
    })
    setSaving(false)
    if (error) {
      console.error('[savings] Contribution failed:', error)
      toast.error('Failed to save contribution')
      return
    }

    const result = (Array.isArray(data) ? data[0] : data) as SavingsContributionResult | undefined
    if (!result) {
      toast.error('No contribution result returned')
      return
    }

    haptic('medium')
    if (!result.applied) {
      toast.info(mode === 'planned' ? 'This month is already confirmed' : 'This contribution was already saved')
    } else if (result.achieved) {
      haptic('heavy')
      onGoalComplete?.()
    } else {
      toast.success(`+$${Number(result.applied_amount).toFixed(2)} added to ${goal.name}!`)
    }
    setAmount('')
    onSuccess(Number(result.new_total), mode)
    onClose()
  }

  const sheetTitle = mode === 'planned' ? 'Confirm Monthly Savings' : 'Add Savings'

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
            Progress: ${formatNumber(goal.current_usd)} / ${formatNumber(goal.target_usd)}
          </p>
          {mode === 'planned' && (
            <p className="mt-1 text-[11px] font-black uppercase tracking-wider" style={{ color: goal.color }}>
              Planned monthly contribution
            </p>
          )}
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
      <BottomSheet isOpen={isOpen} onClose={onClose} title={sheetTitle}>
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
              <h2 className="text-xl font-black">{sheetTitle}</h2>
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
                      {saving ? 'Saving...' : `Confirm $${parseFloat(amount || '0').toLocaleString()} Deposit`}
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
