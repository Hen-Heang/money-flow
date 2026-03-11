'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { getUserProfile } from '@/lib/profile'
import Avatar from '@/components/ui/Avatar'
import { formatKRW, formatUSD, getDisplayName, getGreeting } from '@/lib/utils'
import { CardSkeleton } from '@/components/ui/Skeleton'
import FAB from '@/components/ui/FAB'
import AddTransactionSheet from '@/components/transactions/AddTransactionSheet'

interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  description: string
  amount_krw: number
  amount_usd: number
  category_id: string | null
  categories?: { name: string; icon: string; color: string } | null
}

interface CategoryTotal {
  name: string
  icon: string
  color: string
  total: number
}

interface ExchangeRateInfo {
  rate: number
  base_currency: string
  target_currency: string
  fetched_at: string
  cached?: boolean
  fallback?: boolean
  error?: boolean
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateInfo | null>(null)
  const supabase = createClient()

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profile = await getUserProfile(supabase, user)
      setUserName(getDisplayName(profile.email, profile.display_name))
      setAvatarUrl(profile.avatar_url)

      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('user_id', user.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: false })

      setTransactions((data as Transaction[]) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    let active = true

    const loadExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate', { cache: 'no-store' })
        if (!response.ok) return

        const data = await response.json() as ExchangeRateInfo
        if (active) {
          setExchangeRateInfo(data)
        }
      } catch (error) {
        console.error(error)
      }
    }

    loadExchangeRate()

    return () => {
      active = false
    }
  }, [])

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const balance = totalIncome - totalExpense

  const totalIncomeUSD = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_usd, 0)
  const totalExpenseUSD = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_usd, 0)
  const balanceUSD = totalIncomeUSD - totalExpenseUSD

  // Category breakdown for pie chart
  const categoryTotals: CategoryTotal[] = []
  transactions
    .filter(t => t.type === 'expense' && t.categories)
    .forEach(t => {
      const cat = t.categories!
      const existing = categoryTotals.find(c => c.name === cat.name)
      if (existing) {
        existing.total += t.amount_krw
      } else {
        categoryTotals.push({ name: cat.name, icon: cat.icon, color: cat.color, total: t.amount_krw })
      }
    })
  categoryTotals.sort((a, b) => b.total - a.total)

  // Daily spending trend
  const dailyData: { day: string; expense: number; income: number }[] = []
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), d), 'yyyy-MM-dd')
    const dayTxns = transactions.filter(t => t.date === dayStr)
    dailyData.push({
      day: String(d),
      expense: dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0),
      income: dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0),
    })
  }

  // Last 6 months bar chart
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const m = subMonths(currentDate, i)
    monthlyData.push({
      month: format(m, 'MMM'),
      income: 0,
      expense: 0,
    })
  }

  const fmt = (amount: number, usd: number) =>
    showUSD ? formatUSD(usd) : formatKRW(amount)

  const formattedExchangeRate = exchangeRateInfo
    ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(exchangeRateInfo.rate)
    : null

  const summaryCards = [
    {
      label: 'Income',
      amount: fmt(totalIncome, totalIncomeUSD),
      icon: TrendingUp,
      color: '#10b981',
      glassClass: 'glass-income',
      iconBg: 'rgba(16,185,129,0.2)',
    },
    {
      label: 'Expense',
      amount: fmt(totalExpense, totalExpenseUSD),
      icon: TrendingDown,
      color: '#ef4444',
      glassClass: 'glass-expense',
      iconBg: 'rgba(239,68,68,0.2)',
    },
    {
      label: 'Balance',
      amount: fmt(balance, balanceUSD),
      icon: DollarSign,
      color: balance >= 0 ? '#10b981' : '#ef4444',
      glassClass: 'glass-balance',
      iconBg: balance >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
    },
  ]

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto overflow-x-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={avatarUrl} name={userName} size={52} className="ring-1 ring-white/10 shadow-lg" />
          <div className="min-w-0">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{getGreeting()}</p>
            <h1 className="truncate text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {userName}
            </h1>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowUSD(!showUSD)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            touchAction: 'manipulation',
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>{showUSD ? '🇺🇸' : '🇰🇷'}</span>
          <span>{showUSD ? 'USD' : 'KRW'}</span>
        </motion.button>
      </motion.div>

      {exchangeRateInfo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between gap-2 rounded-button px-4 py-2.5"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent-base)' }} />
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              1 USD = KRW {formattedExchangeRate ?? '-'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              {format(new Date(exchangeRateInfo.fetched_at), 'MMM d, HH:mm')}
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: exchangeRateInfo.fallback || exchangeRateInfo.error
                  ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.14)',
                color: exchangeRateInfo.fallback || exchangeRateInfo.error
                  ? 'var(--color-warning-base)' : 'var(--color-income-base)',
              }}
            >
              {exchangeRateInfo.fallback || exchangeRateInfo.error ? 'Est' : exchangeRateInfo.cached ? 'Cached' : 'Live'}
            </span>
          </div>
        </motion.div>
      )}

      {/* Month Selector */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 rounded-full active:scale-90 transition-transform"
          style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 rounded-full active:scale-90 transition-transform"
          style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
        >
          <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        {loading
          ? [1, 2, 3].map(i => <CardSkeleton key={i} />)
          : summaryCards.map(({ label, amount, icon: Icon, color, glassClass, iconBg }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${glassClass} min-h-[132px] p-3 sm:p-4`}
            >
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center mb-2"
                style={{ backgroundColor: iconBg }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
              <p className="break-words text-[13px] font-bold leading-tight sm:text-sm" style={{ color }}>
                {amount}
              </p>
            </motion.div>
          ))
        }
      </div>

      {/* Budget Progress */}
      {totalExpense > 0 && totalIncome > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-[20px] p-5 mb-6"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Budget Usage</h3>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {Math.round((totalExpense / totalIncome) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                backgroundColor: (totalExpense / totalIncome) > 0.8
                  ? 'var(--color-expense-base)'
                  : 'var(--color-income-base)',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {formatKRW(totalExpense)} of {formatKRW(totalIncome)} spent
          </p>
        </motion.div>
      )}

      {/* Daily Trend Chart */}
      {!loading && dailyData.some(d => d.expense > 0 || d.income > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] p-5 mb-6"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Daily Trend</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                interval={4}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card-elevated-base)',
                  border: '1px solid var(--color-border-base)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary)',
                }}
                formatter={(value) => [formatKRW(Number(value))]}
              />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Category Pie Chart */}
      {!loading && categoryTotals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] p-5 mb-6"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Spending by Category</h3>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="mx-auto sm:mx-0">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={categoryTotals}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                  >
                    {categoryTotals.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card-elevated-base)',
                      border: '1px solid var(--color-border-base)',
                      borderRadius: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                    formatter={(value) => [formatKRW(Number(value))]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {categoryTotals.slice(0, 5).map((cat, index) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                  </div>
                  <span className="ml-2 flex-shrink-0 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {formatKRW(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Transactions */}
      {!loading && transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] mb-6 overflow-hidden"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <div className="px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Transactions</h3>
            <a href="/transactions" className="text-xs" style={{ color: 'var(--color-accent-base)' }}>See all</a>
          </div>
          {transactions.slice(0, 5).map(t => (
            <div
              key={t.id}
              className="flex items-center gap-4 px-5 py-3"
              style={{ borderTop: '1px solid var(--color-border-base)' }}
            >
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center text-lg"
                style={{
                  backgroundColor: t.type === 'income'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                }}
              >
                {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {t.description}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {format(new Date(t.date), 'MMM d')}
                  {t.categories ? ` · ${t.categories.name}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p
                  className="text-sm font-semibold"
                  style={{ color: t.type === 'income' ? 'var(--color-income-base)' : 'var(--color-expense-base)' }}
                >
                  {t.type === 'income' ? '+' : '-'}{showUSD ? formatUSD(t.amount_usd) : formatKRW(t.amount_krw)}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && transactions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="text-5xl mb-4">💸</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No transactions yet
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Tap the + button to add your first transaction
          </p>
        </motion.div>
      )}

      {!showAddSheet && <FAB onClick={() => setShowAddSheet(true)} />}
      <AddTransactionSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSuccess={() => loadData()}
      />
    </div>
  )
}
