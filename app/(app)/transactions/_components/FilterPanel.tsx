'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { haptic } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import type { Category } from '@/lib/types'

export function FilterPanel({
  show,
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
  activeFilterCount,
  clearFilters,
}: {
  show: boolean
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
  activeFilterCount: number
  clearFilters: () => void
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3 overflow-hidden"
        >
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: 'var(--color-card-base)', border: '1px solid var(--color-border-base)' }}
          >
            {/* Date range */}
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Date Range</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-primary)' }}
                />
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>

            {/* Amount range */}
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Amount Range (₩)</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filterAmountMin}
                  onChange={e => setFilterAmountMin(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-primary)' }}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filterAmountMax}
                  onChange={e => setFilterAmountMax(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Category</p>
              <Select value={filterCategory || '__none__'} onValueChange={v => setFilterCategory(v === '__none__' ? '' : v)}>
                <SelectTrigger className="w-full rounded-xl px-3 py-2 text-sm">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { clearFilters(); haptic('light') }}
                className="w-full rounded-xl py-2 text-xs font-black uppercase tracking-wider"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-expense-base)' }}
              >
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
