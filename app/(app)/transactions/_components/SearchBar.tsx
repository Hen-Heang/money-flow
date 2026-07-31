'use client'

import type { RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'

export function SearchBar({
  search,
  setSearch,
  showHistory,
  setShowHistory,
  searchHistory,
  clearHistory,
  searchInputRef,
}: {
  search: string
  setSearch: (v: string) => void
  showHistory: boolean
  setShowHistory: (v: boolean) => void
  searchHistory: string[]
  clearHistory: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
      <input
        ref={searchInputRef}
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setShowHistory(true)}
        onBlur={() => setTimeout(() => setShowHistory(false), 150)}
        placeholder="Search transactions..."
        className="w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none"
        style={{
          backgroundColor: 'var(--color-card-elevated-base)',
          border: '1px solid var(--color-border-base)',
          color: 'var(--color-text-primary)',
          fontSize: '16px',
        }}
      />
      {search && (
        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
        </button>
      )}
      <AnimatePresence>
        {showHistory && !search && searchHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-xl z-30"
            style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)' }}
          >
            <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text-secondary)' }}>Recent</p>
            {searchHistory.map(h => (
              <button
                key={h}
                onMouseDown={() => { setSearch(h); setShowHistory(false) }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <Search className="w-3.5 h-3.5 shrink-0 opacity-40" />
                {h}
              </button>
            ))}
            <button
              onMouseDown={() => { clearHistory(); setShowHistory(false) }}
              className="w-full px-4 py-2.5 text-[10px] font-black uppercase tracking-wider border-t text-center"
              style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-base)' }}
            >
              Clear history
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
