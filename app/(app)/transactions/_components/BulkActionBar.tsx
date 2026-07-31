'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { haptic } from '@/lib/utils'

export function BulkActionBar({
  show,
  totalCount,
  selectedIds,
  setSelectedIds,
  allIds,
  onBulkDelete,
}: {
  show: boolean
  totalCount: number
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  allIds: string[]
  onBulkDelete: () => void
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed left-0 right-0 flex justify-center z-30 px-5"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}
          >
            <button
              onClick={() => {
                haptic('light')
                if (selectedIds.size === totalCount) {
                  setSelectedIds(new Set())
                } else {
                  setSelectedIds(new Set(allIds))
                }
              }}
              className="text-xs font-black uppercase tracking-wider"
              style={{ color: 'var(--color-accent-base)' }}
            >
              {selectedIds.size === totalCount ? 'Deselect All' : 'Select All'}
            </button>
            <div className="w-px h-4" style={{ backgroundColor: 'var(--color-border-base)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
              {selectedIds.size} selected
            </span>
            <div className="w-px h-4" style={{ backgroundColor: 'var(--color-border-base)' }} />
            <button
              onClick={onBulkDelete}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-30"
              style={{ backgroundColor: 'var(--color-expense-base)', color: 'white' }}
            >
              <Trash2 size={13} />
              Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
