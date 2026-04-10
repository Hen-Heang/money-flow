'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, differenceInDays, subDays } from 'date-fns'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Lightbulb, Sparkles, Flame,
  AlertTriangle, X
} from 'lucide-react'
import {
  PieChart, Pie, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { getUserProfile } from '@/lib/profile'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import type { Transaction, Category, ExchangeRateInfo } from '@/lib/types'
import { CHART_COLORS } from '@/lib/constants'
import Avatar from '@/components/ui/Avatar'
import { formatKRW, formatUSD, getDisplayName, getGreeting, haptic } from '@/lib/utils'
import FAB from '@/components/ui/FAB'
import AddTransactionSheet from '@/components/transactions/AddTransactionSheet'
import dynamic from 'next/dynamic'
const ChatBot = dynamic(() => import('@/components/ai/ChatBot'), { ssr: false })
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { QUICK_TEMPLATES } from '@/shared/data'

interface CategoryTotal {
  name: string;
  icon: string;
  color: string;
  total: number;
  budget?: number;
}



export default function DashboardPage() {
  const router = useRouter()
  const [greeting, setGreeting] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'categories'>('overview')
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [alertsDismissed, setAlertsDismissed] = useState(false)
  const [budgetReviewDismissed, setBudgetReviewDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    const currentMonth = new Date().toISOString().slice(0, 7)
    return localStorage.getItem('budgetReviewDismissed') === currentMonth
  })

  const dismissBudgetReview = () => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    localStorage.setItem('budgetReviewDismissed', currentMonth)
    setBudgetReviewDismissed(true)
  }

  const showBudgetReview = !budgetReviewDismissed && new Date().getDate() <= 5 && isSameMonth(currentDate, new Date())
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateInfo | null>(null)
  const [streak, setStreak] = useState(0)
  const supabase = useSupabaseClient()

  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : false

  // Streak: count consecutive days with at least one logged transaction.
  // Defined first so all effects and handlers below can reference it safely.
  const refreshStreak = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('transactions')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (!data) return

    const uniqueDates = new Set(data.map((r: { date: string }) => r.date))
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    // Start from today; if nothing logged yet today, allow yesterday (streak not broken mid-day)
    let cursor: Date | null = uniqueDates.has(today)
      ? new Date()
      : uniqueDates.has(yesterday)
      ? subDays(new Date(), 1)
      : null
    if (!cursor) { setStreak(0); return }

    let count = 0
    while (uniqueDates.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
      cursor = subDays(cursor, 1)
    }
    setStreak(count)
  }, [supabase])

  const loadData = useCallback(async () => {
    setLoading(true)
    setAlertsDismissed(false)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/login')
        return
      }

      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)

      const profile = await getUserProfile(supabase, user)
      setUserName(getDisplayName(profile?.email, profile?.display_name))
      setAvatarUrl(profile?.avatar_url ?? null)

      const [txResult, budsResult, catsResult] = await Promise.all([
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
          .eq('user_id', user.id),
        supabase.from('categories').select('*'),
      ])

      setTransactions((txResult.data as Transaction[]) || [])
      if (catsResult.data) setCategories(catsResult.data)

      if (budsResult.data) {
        const map: Record<string, number> = {}
        budsResult.data.forEach((b: { category_id: string; amount_krw: number }) => {
          map[b.category_id] = b.amount_krw
        })
        setBudgetMap(map)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
      toast.error('Failed to sync data')
    } finally {
      setLoading(false)
    }
  }, [currentDate, supabase, router])

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => { refreshStreak() }, [refreshStreak])

  // Supabase Realtime — dashboard refreshes automatically when transactions change on any device
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadData()
        refreshStreak()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadData, refreshStreak])

  useEffect(() => {
    let active = true
    const loadExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate', { next: { revalidate: 900 } })
        if (!response.ok) return
        const data = await response.json() as ExchangeRateInfo
        if (active) setExchangeRateInfo(data)
      } catch {}
    }
    loadExchangeRate()
    return () => { active = false }
  }, [])

  const handleQuickAdd = async (template: typeof QUICK_TEMPLATES[0]) => {
    haptic('medium')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const category = categories.find(c => c.name === template.category)
    const rate = exchangeRateInfo?.rate || 1350
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
    if (error) { toast.error('Quick Add failed'); return }
    toast.success(`Logged ${template.iconEmoji} ${template.name}`)
    loadData()
    refreshStreak()
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const balance = totalIncome - totalExpense
  const liveRate = exchangeRateInfo?.rate || 1350

  const insights = useMemo(() => {
    const today = new Date()
    const isCurrentMonth = isSameMonth(currentDate, today)
    const daysPassed = isCurrentMonth ? today.getDate() : differenceInDays(endOfMonth(currentDate), startOfMonth(currentDate)) + 1
    const daysInMonthTotal = differenceInDays(endOfMonth(currentDate), startOfMonth(currentDate)) + 1
    const daysRemaining = isCurrentMonth ? Math.max(daysInMonthTotal - today.getDate(), 0) : 0
    const dailyAvg = totalExpense / Math.max(daysPassed, 1)
    const projectedExpense = isCurrentMonth ? totalExpense + dailyAvg * daysRemaining : totalExpense
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
    return { dailyAvg, savingsRate, projectedExpense, daysRemaining, isCurrentMonth }
  }, [totalExpense, totalIncome, currentDate])

  const totalBudget = useMemo(() => Object.values(budgetMap).reduce((s, v) => s + v, 0), [budgetMap])

  // How much can you spend per day for the rest of the month and still hit budget?
  const dailyBudgetRemaining = useMemo(() => {
    if (!insights.isCurrentMonth || totalBudget === 0) return null
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const todaySpending = transactions
      .filter(t => t.type === 'expense' && t.date === todayStr)
      .reduce((s, t) => s + t.amount_krw, 0)
    const daysLeft = Math.max(insights.daysRemaining, 1)
    const budgetLeft = totalBudget - totalExpense
    const perDay = budgetLeft / daysLeft
    return { perDay, todaySpending, todayAllowance: totalBudget / (daysLeft + today.getDate() - 1), over: budgetLeft < 0 }
  }, [totalBudget, totalExpense, transactions, insights])

  const categoryTotalsMap = new Map<string, CategoryTotal>()
  transactions.filter(t => t.type === 'expense' && t.categories).forEach(t => {
    const cat = t.categories!
    const existing = categoryTotalsMap.get(cat.name)
    if (existing) {
      existing.total += t.amount_krw
    } else {
      categoryTotalsMap.set(cat.name, { name: cat.name, icon: cat.icon, color: cat.color, total: t.amount_krw, budget: t.category_id ? budgetMap[t.category_id] : undefined })
    }
  })
  const categoryTotals: CategoryTotal[] = Array.from(categoryTotalsMap.values()).sort((a, b) => b.total - a.total)

  const budgetAlerts = isSameMonth(currentDate, new Date())
    ? categoryTotals
        .filter(c => c.budget && c.budget > 0 && c.total >= c.budget * 0.8)
        .map(c => ({
          name: c.name,
          icon: c.icon,
          spent: c.total,
          budget: c.budget!,
          over: c.total >= c.budget!,
          pct: Math.round((c.total / c.budget!) * 100),
        }))
    : []

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

  const fmt = (amount: number) => showUSD ? formatUSD(amount / liveRate) : formatKRW(amount)

  return (
    <div className="w-full max-w-full lg:max-w-6xl xl:max-w-7xl mx-auto pt-4 pb-24 md:pt-10 px-0 sm:px-5 lg:px-8 overflow-x-hidden">
      {/* ─── Top Header (Always Full Width) ─── */}
      <div className="px-5 sm:px-0 mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={avatarUrl} name={userName} size={38} className="ring-1 ring-[var(--color-border-base)] shadow-lg shrink-0 sm:w-12 sm:h-12" />
          <div className="min-w-0">
            <p className="text-tiny text-[var(--color-text-secondary)] opacity-60 mb-0.5">{greeting}</p>
            <h1 className="text-base sm:text-xl font-black tracking-tight truncate">{userName}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {streak > 0 && (
            <motion.div
              key={streak}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              title={`${streak}-day logging streak`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-tiny font-black"
              style={{
                background: streak >= 7
                  ? 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)'
                  : streak >= 3
                  ? 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)'
                  : 'var(--color-card-elevated-base)',
                color: streak >= 3 ? '#fff' : 'var(--color-text-secondary)',
                border: streak < 3 ? '1px solid var(--color-border-base)' : 'none',
              }}
            >
              <Flame size={11} className={streak >= 3 ? 'text-white' : ''} />
              <span>{streak}</span>
            </motion.div>
          )}
          <button onClick={() => { haptic('light'); setShowUSD(!showUSD) }} className="px-3 py-1.5 rounded-lg glass-morphic text-tiny active:scale-95 transition-all flex items-center gap-1.5">
            {showUSD ? '🇺🇸 USD' : '🇰🇷 KRW'}
          </button>
          <ChatBot />
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 xl:gap-12">
        
        {/* ─── LEFT COLUMN: Main Stats & Charts ─── */}
        <div className="space-y-6">
          
          {/* Main Balance Card */}
          <div className="px-5 sm:px-0">
            <div className="flex flex-col gap-3 mb-6">
              <div className="min-w-0">
                <p className="text-tiny text-[var(--color-text-secondary)] mb-1 opacity-50">Available Balance</p>
                <h2 className={`text-3xl sm:text-5xl font-black tracking-tighter truncate leading-none ${balance >= 0 ? 'text-[var(--color-income-base)]' : 'text-[var(--color-expense-base)]'}`}>
                  {fmt(balance)}
                </h2>
              </div>
              
              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black tracking-tight uppercase opacity-70" suppressHydrationWarning>{format(currentDate, 'MMMM yyyy')}</p>
                  {exchangeRateInfo && (
                    <p className="text-[9px] font-bold text-[var(--color-text-secondary)] tracking-tight opacity-40 mt-0.5">
                      1 USD ≈ {new Intl.NumberFormat('ko-KR').format(exchangeRateInfo.rate)} KRW
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { haptic('light'); setCurrentDate(subMonths(currentDate, 1)) }} className="p-2 rounded-lg bg-[var(--color-card-elevated-base)] border border-white/5 active:scale-90 transition-all shadow-sm"><ChevronLeft size={16} /></button>
                  <button onClick={() => { haptic('light'); setCurrentDate(addMonths(currentDate, 1)) }} className="p-2 rounded-lg bg-[var(--color-card-elevated-base)] border border-white/5 active:scale-90 transition-all shadow-sm"><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[var(--color-income-base)]/10 border border-[var(--color-income-base)]/15 shadow-sm">
                 <div className="flex items-center gap-1.5 mb-1.5 opacity-50"><TrendingUp size={12} /><span className="text-tiny">Income</span></div>
                 <p className="text-lg font-black text-[var(--color-income-base)] truncate">{fmt(totalIncome)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--color-expense-base)]/10 border border-[var(--color-expense-base)]/15 shadow-sm">
                 <div className="flex items-center gap-1.5 mb-1.5 opacity-50"><TrendingDown size={12} /><span className="text-tiny">Expense</span></div>
                 <p className="text-lg font-black text-[var(--color-expense-base)] truncate">{fmt(totalExpense)}</p>
              </div>
            </div>
          </div>

          {/* Daily Budget Remaining */}
          <AnimatePresence>
            {dailyBudgetRemaining && !loading && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-5 sm:px-0"
              >
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-2xl border"
                  style={{
                    backgroundColor: dailyBudgetRemaining.over
                      ? 'rgba(239,68,68,0.08)'
                      : dailyBudgetRemaining.perDay < dailyBudgetRemaining.todayAllowance * 0.3
                      ? 'rgba(245,158,11,0.08)'
                      : 'rgba(16,185,129,0.08)',
                    borderColor: dailyBudgetRemaining.over
                      ? 'rgba(239,68,68,0.2)'
                      : dailyBudgetRemaining.perDay < dailyBudgetRemaining.todayAllowance * 0.3
                      ? 'rgba(245,158,11,0.2)'
                      : 'rgba(16,185,129,0.2)',
                  }}
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-50">Daily budget left</p>
                    <p
                      className="text-xl font-black tracking-tight leading-tight mt-0.5"
                      style={{
                        color: dailyBudgetRemaining.over
                          ? 'var(--color-expense-base)'
                          : dailyBudgetRemaining.perDay < dailyBudgetRemaining.todayAllowance * 0.3
                          ? 'var(--color-warning-base)'
                          : 'var(--color-income-base)',
                      }}
                    >
                      {dailyBudgetRemaining.over ? `−${fmt(Math.abs(dailyBudgetRemaining.perDay))}` : fmt(dailyBudgetRemaining.perDay)}
                    </p>
                    <p className="text-[10px] mt-0.5 opacity-50">
                      {dailyBudgetRemaining.over ? 'over budget — spend less today' : `per day for rest of month`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-50">today</p>
                    <p className="text-sm font-black tracking-tight" style={{ color: 'var(--color-expense-base)' }}>
                      {fmt(dailyBudgetRemaining.todaySpending)}
                    </p>
                    <p className="text-[10px] mt-0.5 opacity-50">spent so far</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New-month budget review prompt (Responsive) */}
          <AnimatePresence>
            {showBudgetReview && !loading && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="px-5 sm:px-0">
                <div className="rounded-[24px] border p-4 sm:p-5 flex items-center gap-4 bg-blue-500/10 border-blue-500/25 shadow-xl">
                  <span className="text-3xl shrink-0">📅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>Review {format(new Date(), 'MMMM')} budgets</p>
                    <p className="text-[11px] mt-0.5 opacity-60 font-medium">Monthly check-in is recommended.</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => { haptic('light'); router.push('/settings') }} className="px-4 py-2 rounded-xl text-[11px] font-black text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg">Review</button>
                    <button onClick={() => { haptic('light'); dismissBudgetReview() }} className="p-1.5 rounded-full hover:bg-white/10 transition-colors opacity-50"><X size={16} /></button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analytics Area */}
          <div className="px-5 sm:px-0">
            <div className="flex gap-8 sm:gap-12 border-b border-white/5 mb-8 overflow-x-auto no-scrollbar pt-2">
              {(['overview', 'trends', 'categories'] as const).map(tab => (
                <button key={tab} onClick={() => { haptic('light'); setActiveTab(tab) }} className={`pb-4 text-[11px] font-black uppercase tracking-[0.25em] relative transition-all whitespace-nowrap ${activeTab === tab ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] opacity-40 hover:opacity-100'}`}>
                  {tab}
                  {activeTab === tab && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-accent-base)] rounded-full shadow-[0_0_12px_var(--color-accent-base)]" />}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    {/* Mobile-only activity (hidden on desktop because it's in the right column) */}
                    <div className="lg:hidden">
                       <RecentActivity transactions={transactions} router={router} fmt={fmt} />
                    </div>

                    {/* Budget Usage Pill */}
                    {totalIncome > 0 && (
                      <div className="p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] bg-[var(--color-card-elevated-base)] border border-white/5 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] opacity-50">Budget Performance</span>
                          <span className="text-base sm:text-lg font-black tracking-tighter">{Math.round((totalExpense / totalIncome) * 100)}% Used</span>
                        </div>
                        <div className="h-3 sm:h-4 rounded-full bg-black/30 overflow-hidden p-1 border border-white/5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }} className={`h-full rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${totalExpense/totalIncome > 0.8 ? 'bg-[var(--color-expense-base)]' : 'bg-[var(--color-accent-base)]'}`} />
                        </div>
                        <p className="mt-3 text-[10px] sm:text-[11px] text-[var(--color-text-secondary)] font-medium text-center">Remaining cash flow: {fmt(Math.max(0, totalIncome - totalExpense))}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'trends' && (
                  <div className="card-premium p-6 sm:p-10 min-h-[400px]">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-10 opacity-50 text-center">Cash Flow Trendline</h3>
                    <div className="h-[300px] sm:h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyData}>
                          <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-accent-base)" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="var(--color-accent-base)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-base)" opacity={0.2} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--color-text-secondary)' }} interval={isDesktop ? 2 : 4} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--color-text-secondary)' }} width={45} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontWeight: 900 }} />
                          <Area type="monotone" dataKey="expense" stroke="var(--color-accent-base)" strokeWidth={4} fill="url(#trendGrad)" animationDuration={1500} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {activeTab === 'categories' && (
                  <div className="card-premium p-6 sm:p-10">
                     <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-10 opacity-50 text-center">Spending Distribution</h3>
                     <div className="flex flex-col xl:flex-row items-center gap-12">
                        <div className="w-full xl:w-1/2 h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={categoryTotals.map((entry, i) => ({ ...entry, fill: entry.color || CHART_COLORS[i % CHART_COLORS.length] }))} dataKey="total" nameKey="name" innerRadius={80} outerRadius={110} paddingAngle={8} animationBegin={0} animationDuration={1200} stroke="none" />
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full xl:w-1/2 space-y-3.5">
                          {categoryTotals.map((cat, i) => (
                            <div key={cat.name} className="flex items-center justify-between p-4.5 rounded-[20px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
                              <div className="flex items-center gap-4 min-w-0">
                                 <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-lg" style={{ backgroundColor: cat.color || CHART_COLORS[i % CHART_COLORS.length] }} />
                                 <span className="text-sm font-bold truncate tracking-tight">{cat.icon} {cat.name}</span>
                              </div>
                              <span className="text-sm font-black shrink-0 ml-2 tracking-tighter">{fmt(cat.total)}</span>
                            </div>
                          ))}
                        </div>
                     </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Intelligence & Actions (Sticky on Desktop) ─── */}
        <div className="lg:sticky lg:top-24 lg:h-fit space-y-8 mt-12 lg:mt-0">
          
          {/* AI Insights Card (Command Center Header) */}
          <div className="px-5 sm:px-0">
             {!loading && (
               <div className="p-6 rounded-[28px] bg-gradient-to-br from-blue-600/15 via-purple-600/10 to-transparent border border-white/10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform group-hover:opacity-10"><Sparkles size={48} /></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400"><Lightbulb size={14} /></div>
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Financial AI</span>
                    </div>
                    <p className="text-xs font-bold leading-relaxed mb-5 text-[var(--color-text-primary)]">
                      {insights.savingsRate > 30 ? "Savings rate is elite. Focus on asset allocation." : 
                       insights.dailyAvg > 100000 ? `High daily burn detected: ${fmt(insights.dailyAvg)}.` : 
                       "Cash flow is stable. Good month for your savings goal."}
                    </p>
                    {insights.isCurrentMonth && insights.daysRemaining > 0 && (
                      <div className="space-y-3">
                         <div className="flex justify-between text-[10px] font-black uppercase tracking-wider opacity-40">
                            <span>Projected</span>
                            <span>{fmt(insights.projectedExpense)}</span>
                         </div>
                         <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((insights.projectedExpense / (totalIncome || 1)) * 100, 100)}%` }} className="h-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
                         </div>
                      </div>
                    )}
                  </div>
               </div>
             )}
          </div>

          {/* Quick Add Section */}
          <div className="px-5 sm:px-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40 pl-1">Quick Logging</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 lg:gap-4">
              {QUICK_TEMPLATES.map(t => (
                <motion.button key={t.name} whileTap={{ scale: 0.95 }} onClick={() => handleQuickAdd(t)} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--color-card-elevated-base)] border border-white/5 shadow-md hover:border-white/20 transition-all text-left">
                  <span className="text-xl sm:text-2xl shrink-0">{t.iconEmoji}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider leading-tight">{t.name}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Desktop Recent Activity (Fixed position in sidebar) */}
          <div className="hidden lg:block px-5 sm:px-0">
             <RecentActivity transactions={transactions} router={router} fmt={fmt} limit={6} />
          </div>

          {/* Budget Alerts (Stacked in Sidebar on Desktop) */}
          <div className="px-5 sm:px-0">
            <BudgetAlerts alerts={budgetAlerts} dismissed={alertsDismissed} onDismiss={() => setAlertsDismissed(true)} router={router} />
          </div>

        </div>
      </div>

      <FAB onClick={() => setShowAddSheet(true)} />
      <AddTransactionSheet isOpen={showAddSheet} onClose={() => setShowAddSheet(false)} onSuccess={() => { loadData(); refreshStreak() }} />
    </div>
  )
}

function RecentActivity({ transactions, router, fmt, limit = 5 }: { transactions: Transaction[], router: ReturnType<typeof useRouter>, fmt: (amount: number) => string, limit?: number }) {
  return (
    <div className="card-premium shadow-xl overflow-hidden">
      <div className="p-5 flex items-center justify-between border-b border-white/5 bg-white/[0.01]">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Recent Activity</h3>
        <button onClick={() => router.push('/transactions')} className="text-[9px] font-black text-[var(--color-accent-base)] uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors">ALL</button>
      </div>
      <div className="divide-y divide-white/5">
        {transactions.slice(0, limit).map(t => (
          <div key={t.id} onClick={() => router.push(`/transactions?id=${t.id}`)} className="p-5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer active:scale-[0.98]">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 ${t.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{t.description}</p>
              <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider opacity-50">{format(new Date(t.date), 'MMM d')}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'}`}>
                {t.type === 'income' ? '+' : ''}{fmt(t.amount_krw)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BudgetAlerts({ alerts, dismissed, onDismiss, router }: { alerts: {name: string, icon: string, spent: number, budget: number, over: boolean, pct: number}[], dismissed: boolean, onDismiss: () => void, router: ReturnType<typeof useRouter> }) {
  if (alerts.length === 0 || dismissed) return null
  return (
    <div className={`rounded-[24px] border p-5 ${alerts.some(a => a.over) ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'} shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className={alerts.some(a => a.over) ? 'text-red-400' : 'text-amber-400'} />
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${alerts.some(a => a.over) ? 'text-red-400' : 'text-amber-400'}`}>Budget Alert</span>
        </div>
        <button onClick={onDismiss} className="p-1 hover:bg-white/5 rounded-full opacity-40 hover:opacity-100 transition-all"><X size={14} /></button>
      </div>
      <div className="space-y-4">
        {alerts.map(alert => (
          <div key={alert.name} onClick={() => router.push('/analytics')} className="cursor-pointer group">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-bold">{alert.icon} {alert.name}</span>
              <span className={`text-[10px] font-black ${alert.over ? 'text-red-400' : 'text-amber-400'}`}>{alert.pct}% Used</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full transition-all ${alert.over ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(alert.pct, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
