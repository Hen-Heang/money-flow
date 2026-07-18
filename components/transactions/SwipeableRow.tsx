'use client'

import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { format, parseISO } from 'date-fns'
import { CheckSquare, Square, Copy, Edit3, MoreHorizontal, Trash2 } from 'lucide-react'
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
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
    if (selectMode) {
      haptic('light')
      onSelect?.(transaction.id)
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
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        onTap={handleTap}
        animate={{ opacity: deleting ? 0 : 1 }}
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

        {/* Amount + date */}
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
        </div>

        {/* Transaction actions */}
        {!selectMode && (
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  haptic('light')
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={`Actions for ${transaction.description}`}
                title="Transaction actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuPrimitive.Trigger>

            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align="end"
                sideOffset={6}
                className="z-[250] min-w-40 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-base)] bg-[var(--color-card-elevated-base)] p-1.5 shadow-xl backdrop-blur-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <DropdownMenuPrimitive.Item
                  onSelect={() => {
                    haptic('light')
                    onDuplicate(transaction)
                  }}
                  className="flex cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-[var(--color-card-base)] focus:bg-[var(--color-card-base)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Copy className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                  Copy
                </DropdownMenuPrimitive.Item>
                <DropdownMenuPrimitive.Item
                  onSelect={() => {
                    haptic('light')
                    onEdit(transaction)
                  }}
                  className="flex cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-[var(--color-card-base)] focus:bg-[var(--color-card-base)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Edit3 className="h-4 w-4" style={{ color: 'var(--color-accent-base)' }} />
                  Edit
                </DropdownMenuPrimitive.Item>
                <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[var(--color-border-base)]" />
                <DropdownMenuPrimitive.Item
                  onSelect={handleDelete}
                  className="flex cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-red-500/10 focus:bg-red-500/10"
                  style={{ color: 'var(--color-expense-base)' }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuPrimitive.Item>
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
        )}
      </motion.div>
    </div>
  )
})

export default SwipeableRow
