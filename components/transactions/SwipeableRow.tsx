'use client'

import { useState, useRef, memo } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { CheckSquare, Square, Copy, Edit3, Trash2, Ellipsis } from 'lucide-react'
import { formatKRW, formatUSD, haptic } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

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
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isDragging = useRef(false)
  const dragEndTime = useRef(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    dragEndTime.current = Date.now()
    // Delay reset so onTap (which fires after onDragEnd) still sees isDragging=true
    setTimeout(() => { isDragging.current = false }, 80)
    if (info.offset.x < -80) {
      setOffset(-160)
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
    // Ignore tap that fires immediately after a drag gesture ends
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

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      setOffset(-160)
      haptic('light')
    }, 500)
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <div className="relative overflow-hidden" onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}>
      {/* Confirm delete dialog */}
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

      {/* Actions: revealed by swipe on mobile, "..." menu on desktop */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center px-3 gap-2">
        {/* Desktop: "..." button → expands to action buttons on hover */}
        <div
          className="hidden md:flex items-center gap-1.5"
          style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none' }}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <AnimatePresence>
            {menuOpen && (
              <>
                <motion.button
                  key="copy"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.15, delay: 0.06 }}
                  onClick={(e) => { e.stopPropagation(); haptic('light'); setMenuOpen(false); onDuplicate(transaction) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}
                  title="Duplicate"
                >
                  <Copy className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                </motion.button>
                <motion.button
                  key="edit"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.15, delay: 0.03 }}
                  onClick={(e) => { e.stopPropagation(); haptic('light'); setMenuOpen(false); onEdit(transaction) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{ backgroundColor: 'var(--color-accent-base)' }}
                  title="Edit"
                >
                  <Edit3 className="w-3.5 h-3.5 text-white" />
                </motion.button>
                <motion.button
                  key="delete"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); handleDelete() }}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{ backgroundColor: 'var(--color-expense-base)' }}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </motion.button>
              </>
            )}
          </AnimatePresence>
          <button
            onMouseEnter={() => setMenuOpen(true)}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-90"
            style={{
              backgroundColor: menuOpen ? 'var(--color-card-elevated-base)' : 'transparent',
              border: `1px solid ${menuOpen ? 'var(--color-border-base)' : 'transparent'}`,
            }}
            title="More actions"
          >
            <Ellipsis className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
        {/* Mobile swipe buttons — revealed when content slides left */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => { haptic('light'); setOffset(0); onDuplicate(transaction) }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}
          >
            <Copy className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <button
            onClick={() => { haptic('light'); setOffset(0); onEdit(transaction) }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-accent-base)' }}
          >
            <Edit3 className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={handleDelete}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-expense-base)' }}
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <motion.div
        drag={selectMode ? false : 'x'}
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragStart={() => {
          if (selectMode) return
          isDragging.current = true
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
        }}
        onDragEnd={selectMode ? undefined : handleDragEnd}
        onTap={handleTap}
        onPointerDown={selectMode ? undefined : handlePointerDown}
        onPointerUp={selectMode ? undefined : handlePointerUp}
        onPointerLeave={selectMode ? undefined : handlePointerUp}
        animate={{ x: selectMode ? 0 : offset, opacity: deleting ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-center gap-4 px-4 py-3 relative cursor-pointer z-10"
        style={{
          backgroundColor: selected ? 'color-mix(in srgb, var(--color-accent-base) 12%, var(--color-card-base))' : 'var(--color-card-base)',
        }}
      >
        {selectMode && (
          <div className="shrink-0" style={{ color: selected ? 'var(--color-accent-base)' : 'var(--color-text-secondary)' }}>
            {selected ? <CheckSquare size={20} /> : <Square size={20} />}
          </div>
        )}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-button text-xl"
          style={{
            backgroundColor: transaction.type === 'income'
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
          }}
        >
          {transaction.categories?.icon || (transaction.type === 'income' ? '💰' : '💸')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {transaction.description}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {transaction.categories?.name || 'Uncategorized'}
            {transaction.payment_methods ? ` · ${transaction.payment_methods.icon} ${transaction.payment_methods.name}` : ''}
          </p>
          {transaction.note && (
            <p className="text-xs mt-0.5 italic truncate" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
              {transaction.note}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-sm font-semibold"
            style={{
              color: transaction.type === 'income'
                ? 'var(--color-income-base)'
                : 'var(--color-expense-base)',
            }}
          >
            {transaction.type === 'income' ? '+' : '-'}
            {showUSD ? formatUSD(transaction.amount_krw / liveRate) : formatKRW(transaction.amount_krw)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {format(parseISO(transaction.date), 'MMM d')}
          </p>
        </div>
      </motion.div>
    </div>
  )
})

export default SwipeableRow
