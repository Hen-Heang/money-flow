'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCategories } from '@/hooks/useCategories'
import FAB from '@/components/ui/FAB'
import type { Transaction } from '@/lib/types'
import { useSearchHistory } from './_hooks/useSearchHistory'
import { useTransactionFilters } from './_hooks/useTransactionFilters'
import { useTransactionsList } from './_hooks/useTransactionsList'
import { useTransactionSheetState } from './_hooks/useTransactionSheetState'
import { useBulkSelect } from './_hooks/useBulkSelect'
import { TransactionsHeader } from './_components/TransactionsHeader'
import { TransactionGroupList } from './_components/TransactionGroupList'
import { BulkActionBar } from './_components/BulkActionBar'

const AddTransactionSheet = dynamic(() => import('@/components/transactions/AddTransactionSheet'), { ssr: false })
const RecurringSheet = dynamic(() => import('@/components/transactions/RecurringSheet'), { ssr: false })

function TransactionsPageInner() {
  const [showUSD, setShowUSD] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const { categories } = useCategories()

  const {
    search, setSearch, debouncedSearch, searchHistory, clearHistory, showHistory, setShowHistory,
  } = useSearchHistory()

  const {
    filter, setFilter, sort, setSort,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
    filterCategory, setFilterCategory, filterAmountMin, setFilterAmountMin,
    filterAmountMax, setFilterAmountMax, activeFilterCount, clearFilters,
  } = useTransactionFilters()

  const {
    transactions, loading, hasMore, liveRate, sentinelRef, loadTransactions,
    handleDelete, handleBulkDelete, pulling, pullDistance, pullReady,
  } = useTransactionsList(
    { filter, debouncedSearch, filterDateFrom, filterDateTo, filterCategory, filterAmountMin, filterAmountMax },
    categories,
  )

  const {
    showAddSheet, setShowAddSheet,
    editingTransaction, setEditingTransaction,
    isDuplicating,
    handleEdit, handleNewTransaction, handleDuplicate, handleSheetClose,
  } = useTransactionSheetState()

  const { selectMode, setSelectMode, selectedIds, setSelectedIds, toggleSelect, exitSelectMode } = useBulkSelect()

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setEditingTransaction(undefined)
      setShowAddSheet(true)
    }
  }, [searchParams, setEditingTransaction, setShowAddSheet])

  const searchInputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // Measure top-header height → expose as CSS var so date headers can stick beneath it
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty('--tx-header-h', `${el.offsetHeight}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useKeyboardShortcuts([
    { key: 'n', action: handleNewTransaction, description: 'New transaction' },
    { key: '/', action: () => searchInputRef.current?.focus(), description: 'Focus search' },
    { key: 'Escape', action: () => { setShowAddSheet(false); setShowRecurring(false); exitSelectMode() }, description: 'Close' },
  ])

  const grouped = useMemo(() => {
    const sorted = sort === 'date' ? transactions : [...transactions].sort((a, b) =>
      sort === 'amount_desc' ? b.amount_krw - a.amount_krw : a.amount_krw - b.amount_krw
    )
    return sorted.reduce<Record<string, Transaction[]>>((acc, t) => {
      if (!acc[t.date]) acc[t.date] = []
      acc[t.date].push(t)
      return acc
    }, {})
  }, [transactions, sort])

  return (
    <div className="max-w-2xl mx-auto overflow-x-hidden">
      <TransactionsHeader
        headerRef={headerRef}
        searchInputRef={searchInputRef}
        selectMode={selectMode}
        onEnterSelectMode={() => setSelectMode(true)}
        onExitSelectMode={exitSelectMode}
        onShowRecurring={() => setShowRecurring(true)}
        showUSD={showUSD}
        onToggleUSD={() => setShowUSD(!showUSD)}
        search={search}
        setSearch={setSearch}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        searchHistory={searchHistory}
        clearHistory={clearHistory}
        showFilterPanel={showFilterPanel}
        setShowFilterPanel={setShowFilterPanel}
        activeFilterCount={activeFilterCount}
        filterDateFrom={filterDateFrom}
        setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo}
        setFilterDateTo={setFilterDateTo}
        filterAmountMin={filterAmountMin}
        setFilterAmountMin={setFilterAmountMin}
        filterAmountMax={filterAmountMax}
        setFilterAmountMax={setFilterAmountMax}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        categories={categories}
        clearFilters={clearFilters}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
      />

      {/* Pull-to-refresh indicator */}
      {pulling && (
        <div className="flex justify-center py-2 transition-all" style={{ height: Math.min(pullDistance * 0.6, 44) }}>
          <div className={`flex items-center gap-2 text-xs font-bold transition-all ${pullReady ? 'text-green-400' : 'text-[var(--color-text-secondary)]'}`}>
            <svg className={`w-4 h-4 transition-transform duration-200 ${pullReady ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            {pullReady ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      )}

      <TransactionGroupList
        loading={loading}
        transactions={transactions}
        grouped={grouped}
        search={search}
        showUSD={showUSD}
        liveRate={liveRate}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        selectMode={selectMode}
        selectedIds={selectedIds}
        toggleSelect={toggleSelect}
        sentinelRef={sentinelRef}
        hasMore={hasMore}
      />

      <BulkActionBar
        show={selectMode}
        totalCount={transactions.length}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        allIds={transactions.map(t => t.id)}
        onBulkDelete={() => { handleBulkDelete(Array.from(selectedIds)); exitSelectMode() }}
      />

      {!showAddSheet && !showRecurring && !selectMode && (
        <FAB onClick={handleNewTransaction} />
      )}
      <AddTransactionSheet
        isOpen={showAddSheet}
        onClose={handleSheetClose}
        onSuccess={() => loadTransactions(true, true)}
        editTransaction={editingTransaction}
        isDuplicate={isDuplicating}
      />
      <RecurringSheet
        isOpen={showRecurring}
        onClose={() => setShowRecurring(false)}
      />
    </div>
  )
}

export default function TransactionsPage() {
  return <Suspense><TransactionsPageInner /></Suspense>
}
