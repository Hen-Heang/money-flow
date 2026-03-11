'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { Search, X, Trash2, Edit3 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { formatKRW, formatUSD } from '@/lib/utils'
import { TransactionSkeleton } from '@/components/ui/Skeleton'
import FAB from '@/components/ui/FAB'
import AddTransactionSheet, { EditTransaction } from '@/components/transactions/AddTransactionSheet'

interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  description: string
  amount_krw: number
  amount_usd: number
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  categories?: { name: string; icon: string; color: string } | null
  payment_methods?: { name: string; icon: string } | null
}

type FilterType = 'all' | 'income' | 'expense'

function SwipeableRow({
  transaction,
  showUSD,
  liveRate,
  onDelete,
  onEdit,
}: {
  transaction: Transaction
  showUSD: boolean
  liveRate: number
  onDelete: (id: string) => void
  onEdit: (t: Transaction) => void
}) {
  const [offset, setOffset] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const isDragging = useRef(false)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    isDragging.current = false
    if (info.offset.x < -60) {
      setOffset(-120)
    } else {
      setOffset(0)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    onDelete(transaction.id)
  }

  const handleTap = () => {
    if (offset !== 0) {
      setOffset(0)
      return
    }
    if (!isDragging.current) onEdit(transaction)
  }

  return (
    <div className="relative overflow-hidden">
      {/* Actions revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center px-3 gap-2">
        <button
          onClick={() => { setOffset(0); onEdit(transaction) }}
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

      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => { isDragging.current = true }}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        animate={{ x: offset, opacity: deleting ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-center gap-4 px-4 py-3 relative cursor-pointer"
        style={{ backgroundColor: 'var(--color-card-base)' }}
      >
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0"
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
        <div className="text-right flex-shrink-0">
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
            {format(parseISO(transaction.date), 'h:mm a')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<EditTransaction | undefined>()
  const [liveRate, setLiveRate] = useState(1300)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const supabase = createClient()
  const PAGE_SIZE = 20

  const loadTransactions = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (reset) setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('transactions')
        .select('*, categories(name, icon, color), payment_methods(name, icon)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(reset ? 0 : page * PAGE_SIZE, (reset ? 0 : page) * PAGE_SIZE + PAGE_SIZE - 1)

      if (filter !== 'all') query = query.eq('type', filter)
      if (search) query = query.ilike('description', `%${search}%`)

      const { data, error } = await query
      if (error) throw error

      const newTxns = (data as Transaction[]) || []
      if (reset) {
        setTransactions(newTxns)
        setPage(1)
      } else {
        setTransactions(prev => [...prev, ...newTxns])
        setPage(prev => prev + 1)
      }
      setHasMore(newTxns.length === PAGE_SIZE)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [filter, search, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTransactions(true)
  }, [filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setLiveRate(d.rate) })
      .catch(() => {})
  }, [])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Deleted')
      setTransactions(prev => prev.filter(t => t.id !== id))
    }
  }

  // Group by date
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    const key = t.date
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
  ]

  return (
    <div className="max-w-2xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-20 px-4 pt-4 pb-4"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-bg) 92%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Transactions</h1>
          <button
            onClick={() => setShowUSD(!showUSD)}
            className="px-3 py-1.5 rounded-full text-lg leading-none"
            style={{
              backgroundColor: 'var(--color-card-elevated-base)',
              color: 'var(--color-accent-base)',
              border: '1px solid var(--color-border-base)',
            }}
            aria-label={showUSD ? 'Switch to KRW' : 'Switch to USD'}
            title={showUSD ? 'USD mode' : 'KRW mode'}
          >
            {showUSD ? '🇺🇸' : '🇰🇷'}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-[12px] pl-10 pr-10 py-3 text-sm focus:outline-none"
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

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
              style={{
                backgroundColor: filter === f.value ? 'var(--color-income-base)' : 'var(--color-card-elevated-base)',
                color: filter === f.value ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="pb-4">
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(i => <TransactionSkeleton key={i} />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              No transactions found
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {search ? 'Try a different search term' : 'Add your first transaction using the + button'}
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
                    className="flex items-center justify-between px-4 py-2"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                      {format(parseISO(date), 'EEEE, MMM d')}
                    </p>
                    <div className="flex gap-3 text-xs">
                      {dayIncome > 0 && (
                        <span style={{ color: 'var(--color-income-base)' }}>+{formatKRW(dayIncome)}</span>
                      )}
                      {dayExpense > 0 && (
                        <span style={{ color: 'var(--color-expense-base)' }}>-{formatKRW(dayExpense)}</span>
                      )}
                    </div>
                  </div>

                  {/* Transactions for this date */}
                  <div className="rounded-[16px] overflow-hidden mx-4" style={{ backgroundColor: 'var(--color-card-base)' }}>
                    {txns.map((t, i) => (
                      <div key={t.id}>
                        {i > 0 && (
                          <div className="mx-4 h-px" style={{ backgroundColor: 'var(--color-border-base)' }} />
                        )}
                        <SwipeableRow
                          transaction={t}
                          showUSD={showUSD}
                          liveRate={liveRate}
                          onDelete={handleDelete}
                          onEdit={(t) => {
                            setEditingTransaction(t)
                            setShowAddSheet(true)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => loadTransactions()}
                  className="px-6 py-2 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--color-card-elevated-base)',
                    color: 'var(--color-accent-base)',
                  }}
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!showAddSheet && <FAB onClick={() => { setEditingTransaction(undefined); setShowAddSheet(true) }} />}
      <AddTransactionSheet
        isOpen={showAddSheet}
        onClose={() => { setShowAddSheet(false); setEditingTransaction(undefined) }}
        onSuccess={() => loadTransactions(true)}
        editTransaction={editingTransaction}
      />
    </div>
  )
}
