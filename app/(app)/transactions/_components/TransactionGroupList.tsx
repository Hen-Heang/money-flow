'use client'

import type { RefObject } from 'react'
import { format, parseISO } from 'date-fns'
import { TransactionSkeleton } from '@/components/ui/Skeleton'
import SwipeableRow from '@/components/transactions/SwipeableRow'
import { formatKRW } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

export function TransactionGroupList({
  loading,
  transactions,
  grouped,
  search,
  showUSD,
  liveRate,
  onDelete,
  onEdit,
  onDuplicate,
  selectMode,
  selectedIds,
  toggleSelect,
  sentinelRef,
  hasMore,
}: {
  loading: boolean
  transactions: Transaction[]
  grouped: Record<string, Transaction[]>
  search: string
  showUSD: boolean
  liveRate: number
  onDelete: (id: string) => void
  onEdit: (t: Transaction) => void
  onDuplicate: (t: Transaction) => void
  selectMode: boolean
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  sentinelRef: RefObject<HTMLDivElement | null>
  hasMore: boolean
}) {
  return (
    <div className="pb-4">
      {loading ? (
        <div className="space-y-1 px-mobile">
          {[1, 2, 3, 4, 5].map(i => <TransactionSkeleton key={i} />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-mobile">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-black mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No data
          </h3>
          <p className="text-sm font-bold opacity-50 uppercase tracking-widest">
            {search ? 'No matches' : 'Add something new'}
          </p>
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([date, txns]) => {
            const dayIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
            const dayExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)

            return (
              <div key={date} className="mb-4">
                {/* Date header — sticks below top header while scrolling its group */}
                <div
                  className="sticky z-10 flex items-center justify-between px-mobile py-2"
                  style={{
                    top: 'var(--tx-header-h, 0px)',
                    backgroundColor: 'color-mix(in srgb, var(--color-bg) 88%, transparent)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                >
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-50">
                    {format(parseISO(date), 'EEEE, MMM d')}
                  </p>
                  <div className="flex gap-3 text-[11px] font-black tracking-tight">
                    {dayIncome > 0 && (
                      <span style={{ color: 'var(--color-income-base)' }}>+{formatKRW(dayIncome)}</span>
                    )}
                    {dayExpense > 0 && (
                      <span style={{ color: 'var(--color-expense-base)' }}>-{formatKRW(dayExpense)}</span>
                    )}
                  </div>
                </div>

                {/* Transactions for this date */}
                <div className="mx-mobile overflow-hidden rounded-[24px] border border-[var(--color-border-base)] shadow-sm" style={{ backgroundColor: 'var(--color-card-base)' }}>
                  {txns.map((t, i) => (
                    <div key={t.id}>
                      {i > 0 && (
                        <div className="mx-4 h-px opacity-50" style={{ backgroundColor: 'var(--color-border-base)' }} />
                      )}
                      <SwipeableRow
                        transaction={t}
                        showUSD={showUSD}
                        liveRate={liveRate}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        selectMode={selectMode}
                        selected={selectedIds.has(t.id)}
                        onSelect={toggleSelect}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-8">
            {hasMore ? (
              <div className="flex items-center gap-2 text-xs font-bold opacity-40" style={{ color: 'var(--color-text-secondary)' }}>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading
              </div>
            ) : transactions.length > 0 ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-px rounded-full opacity-20" style={{ backgroundColor: 'var(--color-text-secondary)' }} />
                <span className="text-xs font-medium opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
                  That&apos;s everything
                </span>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
