'use client'

import { useState, useRef, memo } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { CheckSquare, Square, Copy, Edit3, Trash2 } from 'lucide-react'
import { formatKRW, formatUSD, haptic } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

// Width of the revealed action panel on mobile (3 buttons × 56px + 2px gaps)
const ACTION_WIDTH = 170

export interface SwipeableRowProps {
  transaction: Transaction
  showUSD: boolean
  liveRate: number
  onDelete: (id: string) => void
  onEdit: (t: Transaction) => void
  onDuplicate: (t: Transaction) => void
  selectMode?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

const SwipeableRow = memo(function SwipeableRow({
  transaction,
  showUSD,
  liveRate,
  onDelete,
  onEdit,
  onDuplicate,
  selectMode,
  selected,
  onSelect,
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isDragging = useRef(false)
  const dragEndTime = useRef(0)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    dragEndTime.current = Date.now()
    setTimeout(() => { isDragging.current = false }, 80)
    setDragging(false)
    if (info.offset.x < -40) {
      setOffset(-ACTION_WIDTH)
      haptic('light')
    } else {
      setOffset(0)
    }
  }

  const handleDelete = () => {
    haptic('medium')
    setConfirmDelete(true)
  }

  const confirmAndDelete = () => {
    haptic('heavy')
    setDeleting(true)
    setConfirmDelete(false)
    onDelete(transaction.id)
  }

  const handleTap = () => {
    if (isDragging.current || Date.now() - dragEndTime.current < 100) return
    if (selectMode) {
      haptic('light')
      onSelect?.(transaction.id)
      return
    }
    if (offset !== 0) {
      setOffset(0)
      return
    }
    onEdit(transaction)
  }

  return (
    <div className="relative overflow-hidden">
      {/* Confirm delete overlay */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center gap-2 px-4"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-card-base) 96%, transparent)' }}
          >
            <span className="text-sm font-medium mr-2" style={{ color: 'var(--color-text-primary)' }}>Delete?</span>
            <button
              onClick={confirmAndDelete}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-expense-base)' }}
            >
              Delete
            </button>
            <button
              onClick={() => { setConfirmDelete(false); setOffset(0) }}
              className="px-4 py-1.5 rounded-full text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      {!selectMode && (offset !== 0 || dragging) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="md:hidden absolute right-0 top-0 bottom-0 flex z-0"
          style={{ width: ACTION_WIDTH }}
        >
          <button
            onClick={() => { haptic('light'); setOffset(0); onDuplicate(transaction) }}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <button
            onClick={() => { haptic('light'); setOffset(0); onEdit(transaction) }}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: 'var(--color-accent-base)' }}
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: 'var(--color-expense-base)' }}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      <motion.div
        drag={selectMode ? false : 'x'}
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragStart={() => { isDragging.current = true; setDragging(true) }}
        onDragEnd={selectMode ? undefined : handleDragEnd}
        onTap={handleTap}
        animate={{ x: selectMode ? 0 : offset, opacity: deleting ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer relative z-10"
        style={{
          backgroundColor: selected
            ? 'color-mix(in srgb, var(--color-accent-base) 12%, var(--color-card-base))'
            : 'var(--color-card-base)',
        }}
      >
        {selectMode && (
          <div className="shrink-0" style={{ color: selected ? 'var(--color-accent-base)' : 'var(--color-text-secondary)' }}>
            {selected ? <CheckSquare size={20} /> : <Square size={20} />}
          </div>
        )}

        {/* Category icon */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button text-xl"
          style={{
            backgroundColor: transaction.type === 'income'
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
          }}
        >
          {transaction.categories?.icon || (transaction.type === 'income' ? '💰' : '💸')}
        </div>

        {/* Description + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {transaction.description}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {transaction.categories?.name || 'Uncategorized'}
            {transaction.payment_methods ? ` · ${transaction.payment_methods.icon} ${transaction.payment_methods.name}` : ''}
          </p>
          {transaction.note && (
            <p className="text-xs mt-0.5 italic truncate" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
              {transaction.note}
            </p>
          )}
        </div>

        {/* Amount + date + mobile swipe hint dots */}
        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            <p
              className="text-sm font-semibold tabular-nums"
              style={{ color: transaction.type === 'income' ? 'var(--color-income-base)' : 'var(--color-expense-base)' }}
            >
              {transaction.type === 'income' ? '+' : '-'}
              {showUSD ? formatUSD(transaction.amount_krw / liveRate) : formatKRW(transaction.amount_krw)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {format(parseISO(transaction.date), 'MMM d')}
            </p>
          </div>
          {!selectMode && offset === 0 && (
            <div className="md:hidden flex flex-col gap-[3px] opacity-30">
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-text-secondary)' }} />
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-accent-base)' }} />
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-expense-base)' }} />
            </div>
          )}
        </div>

        {/* Desktop: always-visible action buttons */}
        {!selectMode && (
          <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); haptic('light'); onDuplicate(transaction) }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
              style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); haptic('light'); onEdit(transaction) }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
              style={{ backgroundColor: 'var(--color-accent-base)' }}
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
              style={{ backgroundColor: 'var(--color-expense-base)' }}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
})

export default SwipeableRow
