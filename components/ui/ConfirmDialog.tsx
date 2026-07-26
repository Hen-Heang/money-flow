'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { haptic } from '@/lib/utils'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  /** Shows the current value next to the proposed one, so nothing changes unseen. */
  comparison?: { label: string; from: string; to: string }
  /** Plain-language statement of what this does to the monthly picture. */
  impact?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  comparison,
  impact,
  confirmLabel = 'Apply',
  cancelLabel = 'Cancel',
  tone = 'default',
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    haptic('medium')
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  const confirmColor = tone === 'danger' ? 'var(--color-danger-base, #ef4444)' : 'var(--color-accent-base)'

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => { haptic('light'); onClose() }}
            disabled={submitting}
            className="min-h-[44px] rounded-button border border-[var(--color-border-base)] px-5 py-3 text-sm font-bold transition-transform active:scale-95 disabled:opacity-50"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="min-h-[44px] rounded-button px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: confirmColor }}
          >
            {submitting ? 'Applying…' : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        {description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}

        {comparison && (
          <div className="rounded-2xl border border-[var(--color-border-base)] p-4" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest opacity-50">{comparison.label}</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg font-bold tabular-nums line-through opacity-45">{comparison.from}</span>
              <ArrowRight size={16} className="shrink-0 opacity-40" aria-hidden />
              <span className="font-mono text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {comparison.to}
              </span>
            </div>
          </div>
        )}

        {impact && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-blue-400">Monthly impact</p>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              {impact}
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
