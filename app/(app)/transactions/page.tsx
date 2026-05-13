'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, Search, X, Trash2, SlidersHorizontal, CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { formatKRW, haptic } from '@/lib/utils'
import type { Transaction, Category } from '@/lib/types'
import { TransactionSkeleton } from '@/components/ui/Skeleton'
import FAB from '@/components/ui/FAB'
import dynamic from 'next/dynamic'
import { TRANSACTION_PAGE_SIZE, FALLBACK_EXCHANGE_RATE, SEARCH_HISTORY_MAX } from '@/shared/presets'
import { useCategories } from '@/hooks/useCategories'
import SwipeableRow from '@/components/transactions/SwipeableRow'
const AddTransactionSheet = dynamic(() => import('@/components/transactions/AddTransactionSheet'), { ssr: false })
const RecurringSheet = dynamic(() => import('@/components/transactions/RecurringSheet'), { ssr: false })
import type { EditTransaction } from '@/components/transactions/AddTransactionSheet'

type FilterType = 'all' | 'income' | 'expense'
type SortOption = 'date' | 'amount_desc' | 'amount_asc'

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
]

const SORTS: { label: string; value: SortOption }[] = [
  { label: 'Date', value: 'date' },
  { label: '↓ Amount', value: 'amount_desc' },
  { label: '↑ Amount', value: 'amount_asc' },
]

function TransactionsPageInner() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('txSearchHistory') || '[]') } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)

  const addToSearchHistory = (term: string) => {
    if (!term.trim()) return
    const updated = [term, ...searchHistory.filter(h => h !== term)].slice(0, SEARCH_HISTORY_MAX)
    setSearchHistory(updated)
    localStorage.setItem('txSearchHistory', JSON.stringify(updated))
  }

  // Debounce search input for production performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      if (search.trim()) addToSearchHistory(search.trim())
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const [filter, setFilter] = useState<FilterType>('all')
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<EditTransaction | undefined>()
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [liveRate, setLiveRate] = useState(FALLBACK_EXCHANGE_RATE)
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const userIdRef = useRef<string | null>(null)
  const pendingDeletes = useRef(new Map<string, Transaction>())


  // Advanced filters
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAmountMin, setFilterAmountMin] = useState('')
  const [filterAmountMax, setFilterAmountMax] = useState('')
  const { categories } = useCategories()
  const [selectMode, setSelectMode] = useState(false)
  const [sort, setSort] = useState<SortOption>('date')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    haptic('heavy')
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('transactions').delete().in('id', ids)
    if (error) {
      toast.error('Bulk delete failed')
    } else {
      toast.success(`Deleted ${ids.length} transaction${ids.length > 1 ? 's' : ''}`)
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)))
      exitSelectMode()
    }
  }

  const activeFilterCount = [filterDateFrom, filterDateTo, filterCategory, filterAmountMin, filterAmountMax].filter(Boolean).length

  const clearFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterCategory('')
    setFilterAmountMin('')
    setFilterAmountMax('')
  }

  const loadTransactions = useCallback(async (reset = false, silent = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (reset && !silent) setLoading(true)

    try {
      if (!userIdRef.current) {
        const { data: { session } } = await supabase.auth.getSession()
        userIdRef.current = session?.user?.id ?? null
      }
      const userId = userIdRef.current
      if (!userId) return

      let query = supabase
        .from('transactions')
        .select('id, date, type, description, amount_krw, amount_usd, currency, exchange_rate, category_id, payment_method_id, note, categories(name, icon, color), payment_methods(name, icon)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(reset ? 0 : pageRef.current * TRANSACTION_PAGE_SIZE, (reset ? 0 : pageRef.current) * TRANSACTION_PAGE_SIZE + TRANSACTION_PAGE_SIZE - 1)

      if (filter !== 'all') query = query.eq('type', filter)
      if (debouncedSearch) query = query.ilike('description', `%${debouncedSearch}%`)
      if (filterDateFrom) query = query.gte('date', filterDateFrom)
      if (filterDateTo) query = query.lte('date', filterDateTo)
      if (filterCategory) query = query.eq('category_id', filterCategory)
      if (filterAmountMin) query = query.gte('amount_krw', Number(filterAmountMin.replace(/,/g, '')))
      if (filterAmountMax) query = query.lte('amount_krw', Number(filterAmountMax.replace(/,/g, '')))

      const { data, error } = await query
      if (error) throw error

      const newTxns = (data as Transaction[]) || []
      if (reset) {
        setTransactions(newTxns)
        pageRef.current = 1
        setPage(1)
      } else {
        setTransactions(prev => [...prev, ...newTxns])
        pageRef.current += 1
        setPage(prev => prev + 1)
      }
      setHasMore(newTxns.length === TRANSACTION_PAGE_SIZE)
    } catch {
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [filter, debouncedSearch, filterDateFrom, filterDateTo, filterCategory, filterAmountMin, filterAmountMax, supabase])

  useEffect(() => {
    loadTransactions(true)
  }, [filter, debouncedSearch, filterDateFrom, filterDateTo, filterCategory, filterAmountMin, filterAmountMax]) // eslint-disable-line react-hooks/exhaustive-deps

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setEditingTransaction(undefined)
      setShowAddSheet(true)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setLiveRate(d.rate) })
      .catch(() => {})

    // Auto-apply any due recurring transactions silently on page load
    fetch('/api/recurring/apply', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.applied > 0) {
          toast.success(`${d.applied} recurring transaction${d.applied > 1 ? 's' : ''} applied`)
          loadTransactions(true, true)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase Realtime — live sync across devices (Mac, iPhone, etc.)
  // Enrich payloads from already-loaded categories/payment_methods to avoid N+1 DB queries.
  const categoriesRef = useRef(categories)
  useEffect(() => { categoriesRef.current = categories }, [categories])

  useEffect(() => {
    function enrichFromCache(raw: Record<string, unknown>): Transaction {
      const cat = categoriesRef.current.find(c => c.id === raw.category_id)
      return {
        ...(raw as unknown as Transaction),
        categories: cat ? { name: cat.name, icon: cat.icon, color: (cat as Category).color } : null,
        payment_methods: null,
      }
    }

    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          const uid = userIdRef.current
          if (!uid || payload.new.user_id !== uid) return
          const enriched = enrichFromCache(payload.new)
          setTransactions(prev => {
            if (prev.find(t => t.id === enriched.id)) return prev
            return [enriched, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions' },
        (payload) => {
          const uid = userIdRef.current
          if (!uid || payload.new.user_id !== uid) return
          const enriched = enrichFromCache(payload.new)
          setTransactions(prev => prev.map(t => t.id === enriched.id ? enriched : t))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        (payload) => {
          setTransactions(prev => prev.filter(t => t.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])  

  // Infinite scroll — trigger next page when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadTransactions()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadTransactions])

  const { pulling, pullDistance, ready: pullReady } = usePullToRefresh(() => loadTransactions(true, true))

  const handleEdit = useCallback((t: Transaction) => {
    haptic('light')
    setIsDuplicating(false)
    setEditingTransaction({ ...t, currency: t.currency, exchange_rate: t.exchange_rate })
    setShowAddSheet(true)
  }, [])

  const handleNewTransaction = useCallback(() => {
    setEditingTransaction(undefined)
    setIsDuplicating(false)
    setShowAddSheet(true)
  }, [])

  const searchInputRef = useRef<HTMLInputElement>(null)
  useKeyboardShortcuts([
    { key: 'n', action: handleNewTransaction, description: 'New transaction' },
    { key: '/', action: () => searchInputRef.current?.focus(), description: 'Focus search' },
    { key: 'Escape', action: () => { setShowAddSheet(false); setShowRecurring(false); exitSelectMode() }, description: 'Close' },
  ])

  const handleSheetClose = useCallback(() => {
    setShowAddSheet(false)
    setEditingTransaction(undefined)
    setIsDuplicating(false)
  }, [])

  const handleDuplicate = useCallback((t: Transaction) => {
    setEditingTransaction({ ...t, currency: t.currency, exchange_rate: t.exchange_rate })
    setIsDuplicating(true)
    setShowAddSheet(true)
    haptic('light')
  }, [])

  const handleDelete = useCallback((id: string) => {
    // Optimistically remove from UI and save for potential undo
    setTransactions(prev => {
      const item = prev.find(t => t.id === id)
      if (item) pendingDeletes.current.set(id, item)
      return prev.filter(t => t.id !== id)
    })

    let undone = false

    toast(
      (t) => (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Transaction deleted</span>
            <button
              className="text-sm font-black px-2 py-0.5 rounded-lg shrink-0"
              style={{ color: 'var(--color-accent-base)' }}
              onClick={() => {
                undone = true
                const item = pendingDeletes.current.get(id)
                if (item) {
                  setTransactions(prev =>
                    [...prev, item].sort((a, b) => b.date.localeCompare(a.date))
                  )
                  pendingDeletes.current.delete(id)
                }
                toast.dismiss(t.id)
              }}
            >
              Undo
            </button>
          </div>
          {/* Countdown bar */}
          <div className="h-0.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border-base)' }}>
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: 'var(--color-accent-base)',
                animation: 'countdown 5s linear forwards',
              }}
            />
          </div>
        </div>
      ),
      { duration: 5000 }
    )

    // After 5s, commit the delete to DB if not undone
    setTimeout(() => {
      if (undone) return
      const item = pendingDeletes.current.get(id)
      pendingDeletes.current.delete(id)
      supabase.from('transactions').delete().eq('id', id).then(({ error }) => {
        if (error) {
          toast.error('Failed to delete')
          if (item) setTransactions(prev =>
            [...prev, item].sort((a, b) => b.date.localeCompare(a.date))
          )
        }
      })
    }, 5200)
  }, [supabase])

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
      {/* Header */}
      <div
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
                  onClick={() => { haptic('light'); setShowRecurring(true) }}
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
                  onClick={() => { haptic('light'); setSelectMode(true) }}
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
                onClick={() => { haptic('light'); exitSelectMode() }}
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
              onClick={() => { haptic('light'); setShowUSD(!showUSD) }}
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
          </div>
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
                  onMouseDown={() => { setSearchHistory([]); localStorage.removeItem('txSearchHistory'); setShowHistory(false) }}
                  className="w-full px-4 py-2.5 text-[10px] font-black uppercase tracking-wider border-t text-center"
                  style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-base)' }}
                >
                  Clear history
                </button>
              </motion.div>
            )}
          </AnimatePresence>
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

        {/* Advanced filter panel */}
        <AnimatePresence>
          {showFilterPanel && (
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
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid var(--color-border-base)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="">All categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
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

      {/* Transaction list */}
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
                  {/* Date header */}
                  <div
                    className="flex items-center justify-between px-mobile py-2"
                    style={{ backgroundColor: 'var(--color-bg)' }}
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
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          onDuplicate={handleDuplicate}
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

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectMode && (
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
                  if (selectedIds.size === transactions.length) {
                    setSelectedIds(new Set())
                  } else {
                    setSelectedIds(new Set(transactions.map(t => t.id)))
                  }
                }}
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: 'var(--color-accent-base)' }}
              >
                {selectedIds.size === transactions.length ? 'Deselect All' : 'Select All'}
              </button>
              <div className="w-px h-4" style={{ backgroundColor: 'var(--color-border-base)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                {selectedIds.size} selected
              </span>
              <div className="w-px h-4" style={{ backgroundColor: 'var(--color-border-base)' }} />
              <button
                onClick={handleBulkDelete}
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
