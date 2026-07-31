'use client'

import type { RefObject } from 'react'
import { RefreshCw, CheckCheck, SlidersHorizontal } from 'lucide-react'
import { haptic } from '@/lib/utils'
import type { Category } from '@/lib/types'
import { SearchBar } from './SearchBar'
import { FilterPanel } from './FilterPanel'
import { FILTERS, SORTS } from '../_types'
import type { FilterType, SortOption } from '../_types'

export function TransactionsHeader({
  headerRef,
  searchInputRef,
  selectMode,
  onEnterSelectMode,
  onExitSelectMode,
  onShowRecurring,
  showUSD,
  onToggleUSD,
  search,
  setSearch,
  showHistory,
  setShowHistory,
  searchHistory,
  clearHistory,
  showFilterPanel,
  setShowFilterPanel,
  activeFilterCount,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  filterAmountMin,
  setFilterAmountMin,
  filterAmountMax,
  setFilterAmountMax,
  filterCategory,
  setFilterCategory,
  categories,
  clearFilters,
  filter,
  setFilter,
  sort,
  setSort,
}: {
  headerRef: RefObject<HTMLDivElement | null>
  searchInputRef: RefObject<HTMLInputElement | null>
  selectMode: boolean
  onEnterSelectMode: () => void
  onExitSelectMode: () => void
  onShowRecurring: () => void
  showUSD: boolean
  onToggleUSD: () => void
  search: string
  setSearch: (v: string) => void
  showHistory: boolean
  setShowHistory: (v: boolean) => void
  searchHistory: string[]
  clearHistory: () => void
  showFilterPanel: boolean
  setShowFilterPanel: (fn: (v: boolean) => boolean) => void
  activeFilterCount: number
  filterDateFrom: string
  setFilterDateFrom: (v: string) => void
  filterDateTo: string
  setFilterDateTo: (v: string) => void
  filterAmountMin: string
  setFilterAmountMin: (v: string) => void
  filterAmountMax: string
  setFilterAmountMax: (v: string) => void
  filterCategory: string
  setFilterCategory: (v: string) => void
  categories: Category[]
  clearFilters: () => void
  filter: FilterType
  setFilter: (v: FilterType) => void
  sort: SortOption
  setSort: (v: SortOption) => void
}) {
  return (
    <div
      ref={headerRef}
      className="sticky top-0 z-20 px-mobile pt-4 pb-4"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 92%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Transactions</h1>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              <button
                onClick={() => { haptic('light'); onShowRecurring() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-transform active:scale-90"
                style={{
                  backgroundColor: 'var(--color-card-elevated-base)',
                  color: 'var(--color-accent-base)',
                  border: '1px solid var(--color-border-base)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Recurring</span>
              </button>
              <button
                onClick={() => { haptic('light'); onEnterSelectMode() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-transform active:scale-90"
                style={{
                  backgroundColor: 'var(--color-card-elevated-base)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-base)',
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Select</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => { haptic('light'); onExitSelectMode() }}
              className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-transform active:scale-90"
              style={{
                backgroundColor: 'var(--color-card-elevated-base)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-base)',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => { haptic('light'); onToggleUSD() }}
            className="px-3 py-1.5 rounded-full text-lg leading-none transition-transform active:scale-90"
            style={{
              backgroundColor: 'var(--color-card-elevated-base)',
              color: 'var(--color-accent-base)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            {showUSD ? '🇺🇸' : '🇰🇷'}
          </button>
        </div>
      </div>

      {/* Search + Filter button */}
      <div className="flex gap-2 mb-3">
        <SearchBar
          search={search}
          setSearch={setSearch}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          searchHistory={searchHistory}
          clearHistory={clearHistory}
          searchInputRef={searchInputRef}
        />
        <button
          onClick={() => { haptic('light'); setShowFilterPanel(v => !v) }}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-90"
          style={{
            backgroundColor: showFilterPanel || activeFilterCount > 0 ? 'var(--color-accent-base)' : 'var(--color-card-elevated-base)',
            border: '1px solid var(--color-border-base)',
            color: showFilterPanel || activeFilterCount > 0 ? 'white' : 'var(--color-text-secondary)',
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black text-white"
              style={{ backgroundColor: 'var(--color-expense-base)' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <FilterPanel
        show={showFilterPanel}
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
        activeFilterCount={activeFilterCount}
        clearFilters={clearFilters}
      />

      {/* Filter + Sort chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { haptic('light'); setFilter(f.value) }}
            className="shrink-0 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest transition-all active:scale-95"
            style={{
              backgroundColor: filter === f.value ? 'var(--color-income-base)' : 'var(--color-card-elevated-base)',
              color: filter === f.value ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {f.label}
          </button>
        ))}
        <div className="w-px self-stretch my-1 rounded-full" style={{ backgroundColor: 'var(--color-border-base)' }} />
        {SORTS.map(s => (
          <button
            key={s.value}
            onClick={() => { haptic('light'); setSort(s.value) }}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            style={{
              backgroundColor: sort === s.value ? 'var(--color-accent-base)' : 'var(--color-card-elevated-base)',
              color: sort === s.value ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
