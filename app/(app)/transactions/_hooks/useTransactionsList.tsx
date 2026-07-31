'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { haptic } from '@/lib/utils'
import type { Transaction, Category } from '@/lib/types'
import { TRANSACTION_PAGE_SIZE, FALLBACK_EXCHANGE_RATE } from '@/shared/presets'
import { useTransactionsChanged } from '@/hooks/useTransactionSync'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { FilterType } from '../_types'

type TransactionRow = Record<string, unknown>

interface Filters {
  filter: FilterType
  debouncedSearch: string
  filterDateFrom: string
  filterDateTo: string
  filterCategory: string
  filterAmountMin: string
  filterAmountMax: string
}

/**
 * Owns everything tied to the `transactions` array itself: paginated
 * loading, the Supabase realtime subscription that keeps it in sync across
 * tabs/devices, infinite scroll, pull-to-refresh, and the optimistic
 * delete-with-undo flow. Kept as one hook because all of it reads/writes the
 * same `transactions` state and coordinating refs (page, in-flight guard,
 * pending-delete buffer).
 */
export function useTransactionsList(filters: Filters, categories: Category[]) {
  const { filter, debouncedSearch, filterDateFrom, filterDateTo, filterCategory, filterAmountMin, filterAmountMax } = filters

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [liveRate, setLiveRate] = useState(FALLBACK_EXCHANGE_RATE)

  const pageRef = useRef(0)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const userIdRef = useRef<string | null>(null)
  const pendingDeletes = useRef(new Map<string, Transaction>())

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
      } else {
        setTransactions(prev => [...prev, ...newTxns])
        pageRef.current += 1
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

  useTransactionsChanged(useCallback(() => loadTransactions(true, true), [loadTransactions]))

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setLiveRate(d.rate) })
      .catch(() => {})
  }, [])

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
        (payload: RealtimePostgresChangesPayload<TransactionRow>) => {
          const row = payload.new as TransactionRow
          const uid = userIdRef.current
          if (!uid || row.user_id !== uid) return
          const enriched = enrichFromCache(row)
          setTransactions(prev => {
            if (prev.find(t => t.id === enriched.id)) return prev
            return [enriched, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions' },
        (payload: RealtimePostgresChangesPayload<TransactionRow>) => {
          const row = payload.new as TransactionRow
          const uid = userIdRef.current
          if (!uid || row.user_id !== uid) return
          const enriched = enrichFromCache(row)
          setTransactions(prev => prev.map(t => t.id === enriched.id ? enriched : t))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        (payload: RealtimePostgresChangesPayload<TransactionRow>) => {
          const row = payload.old as TransactionRow
          setTransactions(prev => prev.filter(t => t.id !== row.id))
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

  const handleDelete = useCallback((id: string) => {
    // Optimistically remove from UI and save for potential undo
    setTransactions(prev => {
      const item = prev.find(t => t.id === id)
      if (item) pendingDeletes.current.set(id, item)
      return prev.filter(t => t.id !== id)
    })

    let undone = false

    toast.custom(
      (toastId) => (
        <div className="flex flex-col gap-2 min-w-[200px] px-4 py-3 rounded-xl bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] shadow-xl">
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
                toast.dismiss(toastId)
              }}
            >
              Undo
            </button>
          </div>
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
    setTimeout(async () => {
      if (undone) return
      const item = pendingDeletes.current.get(id)
      pendingDeletes.current.delete(id)
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) {
        toast.error('Failed to delete')
        if (item) setTransactions(prev =>
          [...prev, item].sort((a, b) => b.date.localeCompare(a.date))
        )
      }
    }, 5200)
  }, [supabase])

  const handleBulkDelete = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    haptic('medium')
    const count = ids.length
    const snapshot = new Set(ids)

    // Optimistically remove from UI
    setTransactions(prev => prev.filter(t => !snapshot.has(t.id)))

    let undone = false
    const toastId = toast.custom(
      (id) => (
        <span className="flex items-center gap-3 text-sm font-medium px-4 py-3 rounded-xl bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] shadow-xl">
          {count} transaction{count > 1 ? 's' : ''} deleted
          <button
            className="font-black text-blue-400 underline-offset-2 hover:underline"
            onClick={() => {
              undone = true
              toast.dismiss(id)
              window.location.reload()
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 }
    )

    setTimeout(async () => {
      if (undone) return
      haptic('heavy')
      const { error } = await supabase.from('transactions').delete().in('id', ids)
      if (error) {
        toast.error('Bulk delete failed — please refresh')
        toast.dismiss(toastId)
      }
    }, 5100)
  }, [supabase])

  return {
    transactions, setTransactions,
    loading, hasMore,
    liveRate,
    sentinelRef,
    supabase,
    loadTransactions,
    handleDelete,
    handleBulkDelete,
    pulling, pullDistance, pullReady,
  }
}
