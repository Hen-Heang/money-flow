'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, differenceInDays, parseISO } from 'date-fns'
import { 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, 
  ArrowRightLeft, AlertTriangle, Lightbulb, Zap, Target, 
  Coffee, Utensils, Bus, ShoppingBag, Plus, Sparkles, ChevronDown, PieChart as PieIcon,
  FileText, X
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { getUserProfile } from '@/lib/profile'
import Avatar from '@/components/ui/Avatar'
import { formatKRW, formatUSD, getDisplayName, getGreeting, haptic } from '@/lib/utils'
import { CardSkeleton } from '@/components/ui/Skeleton'
import FAB from '@/components/ui/FAB'
import AddTransactionSheet from '@/components/transactions/AddTransactionSheet'
import ChatBot from '@/components/ai/ChatBot'
import toast from 'react-hot-toast'

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

const QUICK_TEMPLATES = [
  { name: 'Coffee', icon: Coffee, amount: 5000, category: 'Food & Drink', iconEmoji: '☕️', color: '#10b981' },
  { name: 'Lunch', icon: Utensils, amount: 12000, category: 'Food & Drink', iconEmoji: '🍱', color: '#3b82f6' },
  { name: 'Bus/Subway', icon: Bus, amount: 1500, category: 'Transport', iconEmoji: '🚌', color: '#f59e0b' },
  { name: 'Grocery', icon: ShoppingBag, amount: 30000, category: 'Shopping', iconEmoji: '🛒', color: '#ef4444' },
]

interface CategoryTotal {
  name: string
  icon: string
  color: string
  total: number
  budget?: number
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

interface Category {
  id: string
  name: string
  icon: string
  color: string
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({})
  const [monthlyChartData, setMonthlyChartData] = useState<{ month: string; income: number; expense: number; savings: number; fullDate: Date }[]>([])
  const [loading, setLoading] = useState(true)
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateInfo | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profile = await getUserProfile(supabase, user)
      setUserName(getDisplayName(profile?.email, profile?.display_name))
      setAvatarUrl(profile?.avatar_url ?? null)

      const today = new Date()
      const [{ data }, budgetsResult, { data: historical }, catsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, categories(name, icon, color)')
          .eq('user_id', user.id)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'))
          .order('date', { ascending: false }),
        supabase
          .from('budgets')
          .select('category_id, amount_krw')
          .eq('user_id', user.id)
          .then((res) => res)
          .catch(() => ({ data: null, error: null })),
        supabase
          .from('transactions')
          .select('date, type, amount_krw')
          .eq('user_id', user.id)
          .gte('date', format(startOfMonth(subMonths(today, 5)), 'yyyy-MM-dd'))
          .lte('date', format(endOfMonth(today), 'yyyy-MM-dd')),
        supabase.from('categories').select('*'),
      ])

      setTransactions((data as Transaction[]) || [])
      if (catsResult.data) setCategories(catsResult.data)

      const buds = budgetsResult.data
      if (buds && !budgetsResult.error) {
        const map: Record<string, number> = {}
        buds.forEach((b: { category_id: string; amount_krw: number }) => {
          map[b.category_id] = b.amount_krw
        })
        setBudgetMap(map)
      }
      if (historical && Array.isArray(historical)) {
        const months = []
        for (let i = 5; i >= 0; i--) {
          const m = subMonths(today, i)
          const prefix = format(m, 'yyyy-MM')
          const txns = (historical as { date: string; type: string; amount_krw: number }[]).filter(t => t.date && t.date.startsWith(prefix))
          const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
          const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
          months.push({ 
            month: format(m, 'MMM'), 
            income, 
            expense, 
            savings: income - expense,
            fullDate: m 
          })
        }
        setMonthlyChartData(months)
      }
    } catch (err) {
      console.error('Detailed Dashboard loadData error:', err)
      toast.error('Failed to sync dashboard data')
    } finally {
      setLoading(false)
    }
  }, [currentDate, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
    setSelectedDate(null) // Reset selection when month changes
  }, [loadData])

  const filteredTransactions = useMemo(() => {
    if (!selectedDate) return transactions
    return transactions.filter(t => t.date === selectedDate)
  }, [transactions, selectedDate])

  useEffect(() => {
    let active = true

    const loadExchangeRate = async (attempt = 0) => {
      try {
        const response = await fetch('/api/exchange-rate', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as ExchangeRateInfo
        if (active) setExchangeRateInfo(data)
      } catch {
        // Retry once after 1.5s — handles transient dev-server startup failures
        if (active && attempt < 1) {
          setTimeout(() => loadExchangeRate(attempt + 1), 1500)
        }
      }
    }

    loadExchangeRate()

    return () => {
      active = false
    }
  }, [])

  const handleQuickAdd = async (template: typeof QUICK_TEMPLATES[0]) => {
    haptic('medium')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const category = categories.find(c => c.name === template.category)
    const rate = exchangeRateInfo?.rate || 1300

    const payload = {
      user_id: user.id,
      type: 'expense',
      description: template.name,
      amount_krw: template.amount,
      amount_usd: template.amount / rate,
      date: format(new Date(), 'yyyy-MM-dd'),
      category_id: category?.id || null,
      currency: 'KRW'
    }

    const { error } = await supabase.from('transactions').insert(payload)
    if (error) {
      toast.error('Quick Add failed')
      return
    }

    toast.success(`Logged ${template.iconEmoji} ${template.name}`)
    loadData()
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const balance = totalIncome - totalExpense
  const liveRate = exchangeRateInfo?.rate || 1300

  // Quick Insights Calculation
  const insights = useMemo(() => {
    const today = new Date()
    let daysPassed: number
    if (isSameMonth(currentDate, today)) {
      daysPassed = today.getDate()
    } else {
      daysPassed = differenceInDays(endOfMonth(currentDate), startOfMonth(currentDate)) + 1
    }

    const dailyAvg = totalExpense / Math.max(daysPassed, 1)
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
    
    return {
      dailyAvg,
      savingsRate,
      isPositive: savingsRate >= 0
    }
  }, [totalExpense, totalIncome, currentDate])

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
        const budget = t.category_id ? budgetMap[t.category_id] : undefined
        categoryTotals.push({ name: cat.name, icon: cat.icon, color: cat.color, total: t.amount_krw, budget })
      }
    })
  categoryTotals.sort((a, b) => b.total - a.total)

  const budgetedCategories = categoryTotals.filter(c => c.budget && c.budget > 0)

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

  const fmt = (amount: number) =>
    showUSD ? formatUSD(amount / liveRate) : formatKRW(amount)

  const formattedExchangeRate = exchangeRateInfo
    ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(exchangeRateInfo.rate)
    : null

  const summaryCards = [
    {
      label: 'Income',
      amount: fmt(totalIncome),
      icon: TrendingUp,
      color: '#10b981',
      glassClass: 'glass-income',
      iconBg: 'rgba(16,185,129,0.2)',
    },
    {
      label: 'Expense',
      amount: fmt(totalExpense),
      icon: TrendingDown,
      color: '#ef4444',
      glassClass: 'glass-expense',
      iconBg: 'rgba(239,68,68,0.2)',
    },
    {
      label: 'Balance',
      amount: fmt(balance),
      icon: DollarSign,
      color: balance >= 0 ? '#10b981' : '#ef4444',
      glassClass: 'glass-balance',
      iconBg: balance >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-2xl overflow-x-hidden px-mobile pt-4 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex flex-col items-start gap-3 min-[431px]:flex-row min-[431px]:items-center min-[431px]:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={avatarUrl} name={userName} size={48} className="ring-1 ring-white/10 shadow-lg" />
          <div className="min-w-0">
            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{getGreeting()}</p>
            <h1 className="truncate text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {userName}
            </h1>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 min-[431px]:w-auto min-[431px]:shrink-0 min-[431px]:justify-end">
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
              fontSize: '12px',
              fontWeight: 600,
              touchAction: 'manipulation',
            }}
          >
            <span style={{ fontSize: '15px', lineHeight: 1 }}>{showUSD ? '🇺🇸' : '🇰🇷'}</span>
            <span>{showUSD ? 'USD' : 'KRW'}</span>
          </motion.button>
          <ChatBot />
        </div>
      </motion.div>

      {/* Month Selector */}
      <div className="mb-6 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex flex-col">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          {exchangeRateInfo && (
             <p className="truncate text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                1 USD = {formattedExchangeRate} KRW
             </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => { haptic('light'); setCurrentDate(subMonths(currentDate, 1)) }}
            className="p-2 rounded-xl active:scale-90 transition-transform"
            style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
          </button>
          <button
            onClick={() => { haptic('light'); setCurrentDate(addMonths(currentDate, 1)) }}
            className="p-2 rounded-xl active:scale-90 transition-transform"
            style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
          >
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-primary)' }} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 space-y-3">
        {loading ? (
          <div className="grid grid-cols-1 gap-3">
            <CardSkeleton />
            <div className="grid grid-cols-2 gap-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        ) : (
          <>
            {/* Primary: Balance */}
            {(() => {
              const balanceCard = summaryCards.find(c => c.label === 'Balance')!
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${balanceCard.glassClass} relative overflow-hidden p-5 shadow-xl sm:p-6`}
                  style={{ borderRadius: '28px' }}
                >
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black mb-1 opacity-60 uppercase tracking-[0.2em]">Total Balance</p>
                      <p
                        className="break-words text-[clamp(2.25rem,10vw,4rem)] font-black leading-none tracking-tighter"
                        style={{ color: balanceCard.color }}
                      >
                        {balanceCard.amount}
                      </p>
                    </div>
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: balanceCard.iconBg }}
                    >
                      <balanceCard.icon className="w-6 h-6" style={{ color: balanceCard.color }} />
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: balanceCard.color }} />
                </motion.div>
              )
            })()}

            {/* Secondary: Income & Expense */}
            <div className="grid grid-cols-2 gap-3">
              {summaryCards.filter(c => c.label !== 'Balance').map(({ label, amount, icon: Icon, color, glassClass, iconBg }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`${glassClass} min-w-0 p-4`}
                  style={{ borderRadius: '24px' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: iconBg }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
                  </div>
                  <p className="truncate text-[clamp(1rem,4.5vw,1.35rem)] font-black leading-none" style={{ color }}>
                    {amount}
                  </p>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Quick Add Row */}
      {!loading && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Sparkles size={14} className="text-blue-400" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Quick Add</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
            {QUICK_TEMPLATES.map((t) => (
              <motion.button
                key={t.name}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleQuickAdd(t)}
                className="flex flex-col items-center justify-center min-w-[92px] h-24 rounded-[28px] bg-[var(--color-card-base)] border border-[var(--color-border-base)] shadow-sm active:bg-blue-500/5 transition-colors"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: t.color + '15' }}>
                  <t.icon size={20} style={{ color: t.color }} />
                </div>
                <span className="text-[11px] font-black tracking-tight">{t.name}</span>
              </motion.button>
            ))}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowAddSheet(true)}
              className="flex flex-col items-center justify-center min-w-[92px] h-24 rounded-[28px] border-2 border-dashed border-white/5 text-white/20"
            >
              <Plus size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest mt-1">More</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {!loading && transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card mb-6 overflow-hidden border border-[var(--color-border-base)]"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <div className="px-5 py-4 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">Recent Activity</h3>
            <a href="/transactions" className="text-xs font-bold text-[var(--color-accent-base)] hover:opacity-80 transition-opacity">View All</a>
          </div>
          <div className="divide-y divide-[var(--color-border-base)]">
            {transactions.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 active:bg-white/[0.03] transition-colors">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm"
                  style={{
                    backgroundColor: t.type === 'income'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(239, 68, 68, 0.12)',
                  }}
                >
                  {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold truncate text-[var(--color-text-primary)]">
                    {t.description}
                  </p>
                  <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-0.5">
                    {format(new Date(t.date), 'MMM d')}
                    {t.categories ? ` • ${t.categories.name}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-[14px] font-black"
                    style={{ color: t.type === 'income' ? 'var(--color-income-base)' : 'var(--color-expense-base)' }}
                  >
                    {t.type === 'income' ? '+' : '-'}{showUSD ? formatUSD(t.amount_krw / liveRate) : formatKRW(t.amount_krw)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Budget Usage */}
      {totalExpense > 0 && totalIncome > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-card p-5 mb-6 border border-[var(--color-border-base)] shadow-sm"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
               <Target className="w-4 h-4 text-[var(--color-text-secondary)]" />
               <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Monthly Budget Usage</h3>
            </div>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[var(--color-card-elevated-base)]" style={{ color: (totalExpense / totalIncome) > 0.8 ? 'var(--color-expense-base)' : 'var(--color-text-secondary)' }}>
              {Math.round((totalExpense / totalIncome) * 100)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-[var(--color-card-elevated-base)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                backgroundColor: (totalExpense / totalIncome) > 0.8
                  ? 'var(--color-expense-base)'
                  : 'var(--color-income-base)',
                boxShadow: `0 0 12px ${(totalExpense / totalIncome) > 0.8 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
              }}
            />
          </div>
          <div className="flex justify-between mt-3">
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Spent</span>
                <p className="text-[13px] font-black text-[var(--color-text-primary)]">{formatKRW(totalExpense)}</p>
             </div>
             <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Total Budget</span>
                <p className="text-[13px] font-black text-[var(--color-text-primary)]">{formatKRW(totalIncome)}</p>
             </div>
          </div>
        </motion.div>
      )}

      {/* Daily Trend Chart */}
      {!loading && dailyData.some(d => d.expense > 0 || d.income > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card p-5 mb-6 border border-[var(--color-border-base)]"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Daily Spending Flow</h3>
             </div>
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                   <div className="w-2 h-2 rounded-full bg-[var(--color-income-base)]" />
                   <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--color-text-secondary)]">In</span>
                </div>
                <div className="flex items-center gap-1">
                   <div className="w-2 h-2 rounded-full bg-[var(--color-expense-base)]" />
                   <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--color-text-secondary)]">Out</span>
                </div>
             </div>
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" vertical={false} opacity={0.5} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'var(--color-text-secondary)', fontWeight: 700 }}
                  interval={4}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card-elevated-base)',
                    border: '1px solid var(--color-border-base)',
                    borderRadius: '12px',
                    color: 'var(--color-text-primary)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                  }}
                  formatter={(value) => [formatKRW(Number(value))]}
                />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={3} />
                <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* 6-Month Overview */}
      {!loading && monthlyChartData.some(m => m.income > 0 || m.expense > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card p-5 mb-6"
          style={{ backgroundColor: 'var(--color-card-base)' }}
        >
          <h3 className="font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>6-Month Overview</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>Income vs Expenses</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
                  : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card-elevated-base)',
                  border: '1px solid var(--color-border-base)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary)',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [formatKRW(value), name === 'income' ? 'Income' : 'Expense']}
              />
              <Legend
                formatter={(value: string) => value === 'income' ? 'Income' : 'Expense'}
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
          {/* This month savings pill */}
          {(() => {
            const last = monthlyChartData[monthlyChartData.length - 1]
            if (!last) return null
            const positive = last.savings >= 0
            return (
              <div
                className="mt-3 flex items-center justify-between rounded-[10px] px-3 py-2"
                style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
              >
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>This month saved</span>
                <span className="text-sm font-semibold" style={{ color: positive ? 'var(--color-income-base)' : 'var(--color-expense-base)' }}>
                  {positive ? '+' : ''}{formatKRW(last.savings)}
                </span>
              </div>
            )
          })()}
        </motion.div>
      )}

      {/* Category Pie Chart */}
      {!loading && categoryTotals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card p-5 mb-6"
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
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
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
          className="rounded-card mb-6 overflow-hidden"
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
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
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
                  {t.type === 'income' ? '+' : '-'}{showUSD ? formatUSD(t.amount_krw / liveRate) : formatKRW(t.amount_krw)}
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
