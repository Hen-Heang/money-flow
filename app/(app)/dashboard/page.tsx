'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { isSameMonth } from 'date-fns'
import { FileText, ChevronRight, Settings } from 'lucide-react'

import { getMonthRange } from '@/lib/dateHelpers'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useTransactionsChanged, emitTransactionsChanged } from '@/hooks/useTransactionSync'
import type { Transaction, ExchangeRateInfo } from '@/lib/types'
import { formatKRW, formatUSD, getDisplayName, getGreeting, haptic } from '@/lib/utils'
import { QUICK_TEMPLATES } from '@/shared/data'
import { BUDGET_REVIEW_DAY_THRESHOLD } from '@/shared/presets'

import Avatar from '@/components/ui/Avatar'
import FAB from '@/components/ui/FAB'
import dynamic from 'next/dynamic'
const AddTransactionSheet = dynamic(() => import('@/components/transactions/AddTransactionSheet'), { ssr: false })
const ChatBot = dynamic(() => import('@/components/ai/ChatBot'), { ssr: false })
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// New modular components
import { SummaryCards } from './components/SummaryCards'
import { BudgetAlerts } from './components/BudgetAlerts'
import { RecentActivity } from './components/RecentActivity'
import { Intelligence } from './components/Intelligence'
import { DailyBudgetPill } from './components/DailyBudgetPill'
import { BudgetReviewPrompt } from './components/BudgetReviewPrompt'
import { AnalyticsTabs } from './components/AnalyticsTabs'

export default function DashboardPage() {
  const router = useRouter()
  const [greeting, setGreeting] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'categories'>('overview')
  const [loading, setLoading] = useState(true)
  const { categories } = useCategories()
  const { budgets: budgetList } = useBudgets()
  const { profile: userProfile } = useUserProfile()
  
  const budgetMap = useMemo(
    () => Object.fromEntries(budgetList.map(b => [b.category_id, b.amount_krw])),
    [budgetList]
  )
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [alertsDismissed, setAlertsDismissed] = useState(false)
  // Start dismissed to match the server render (no localStorage on the server),
  // then resolve the real value after mount to avoid a hydration mismatch.
  const [budgetReviewDismissed, setBudgetReviewDismissed] = useState(true)
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    setBudgetReviewDismissed(localStorage.getItem('budgetReviewDismissed') === currentMonth)
  }, [])

  const dismissBudgetReview = () => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    localStorage.setItem('budgetReviewDismissed', currentMonth)
    setBudgetReviewDismissed(true)
  }

  const showBudgetReview = !budgetReviewDismissed && new Date().getDate() <= BUDGET_REVIEW_DAY_THRESHOLD && isSameMonth(currentDate, new Date())
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateInfo | null>(null)
  const userName = getDisplayName(userProfile?.email, userProfile?.display_name)
  const avatarUrl = userProfile?.avatar_url ?? null
  const supabase = useSupabaseClient()

  // Start false to match the server render, then sync to the real viewport after mount.
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setAlertsDismissed(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        router.push('/login')
        return
      }

      const txResult = await supabase
        .from('transactions')
        .select('id, date, type, amount_krw, description, category_id, categories(name, icon, color)')
        .eq('user_id', user.id)
        .gte('date', getMonthRange(currentDate.getFullYear(), currentDate.getMonth() + 1).start)
        .lt('date', getMonthRange(currentDate.getFullYear(), currentDate.getMonth() + 1).end)
        .order('date', { ascending: false })
      setTransactions((txResult.data as Transaction[]) || [])
    } catch {
      toast.error('Failed to sync data')
    } finally {
      setLoading(false)
    }
  }, [currentDate, supabase, router])

  useEffect(() => {
    setGreeting(getGreeting())
    loadData()
  }, [loadData])

  useTransactionsChanged(loadData)

  useEffect(() => {
    let active = true
    const loadExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate')
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
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const category = categories.find(c => c.name === template.category)
    const rate = exchangeRateInfo?.rate || 1350
    const payload = {
      user_id: user.id,
      type: 'expense',
      description: template.name,
      amount_krw: template.amount,
      amount_usd: template.amount / rate,
      date: new Date().toISOString().slice(0, 10),
      category_id: category?.id || null,
      currency: 'KRW'
    }
    const { error } = await supabase.from('transactions').insert(payload)
    if (error) { toast.error('Quick Add failed'); return }
    toast.success(`Logged ${template.iconEmoji} ${template.name}`)
    loadData()
    emitTransactionsChanged()
  }

  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0), [transactions])
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0), [transactions])
  const balance = totalIncome - totalExpense
  const liveRate = exchangeRateInfo?.rate || 1350

  const insights = useMemo(() => {
    const today = new Date()
    const isCurrentMonth = isSameMonth(currentDate, today)
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const daysPassed = isCurrentMonth ? today.getDate() : daysInMonth
    const daysRemaining = isCurrentMonth ? Math.max(daysInMonth - today.getDate(), 0) : 0
    const dailyAvg = totalExpense / Math.max(daysPassed, 1)
    const projectedExpense = isCurrentMonth ? totalExpense + dailyAvg * daysRemaining : totalExpense
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
    return { dailyAvg, savingsRate, projectedExpense, daysRemaining, isCurrentMonth }
  }, [totalExpense, totalIncome, currentDate])

  const totalBudget = useMemo(() => Object.values(budgetMap).reduce((s, v) => s + v, 0), [budgetMap])

  const dailyBudgetRemaining = useMemo(() => {
    if (!insights.isCurrentMonth || totalBudget === 0) return null
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const todaySpending = transactions
      .filter(t => t.type === 'expense' && t.date === todayStr)
      .reduce((s, t) => s + t.amount_krw, 0)
    const daysLeft = Math.max(insights.daysRemaining, 1)
    const budgetLeft = totalBudget - totalExpense
    const perDay = budgetLeft / daysLeft
    return { perDay, todaySpending, todayAllowance: totalBudget / (daysLeft + today.getDate() - 1), over: budgetLeft < 0 }
  }, [totalBudget, totalExpense, transactions, insights])

  const categoryTotals = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string; total: number }>()
    transactions.filter(t => t.type === 'expense' && t.categories).forEach(t => {
      const cat = t.categories!
      const existing = map.get(cat.name)
      if (existing) {
        existing.total += t.amount_krw
      } else {
        map.set(cat.name, { name: cat.name, icon: cat.icon, color: cat.color, total: t.amount_krw })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [transactions])

  const budgetAlerts = useMemo(() =>
    isSameMonth(currentDate, new Date())
      ? categoryTotals
          .map(c => {
             const budget = budgetList.find(b => b.categories?.name === c.name)?.amount_krw || 0
             return { ...c, budget }
          })
          .filter(c => c.budget > 0 && c.total >= c.budget * 0.8)
          .map(c => ({
            name: c.name,
            icon: c.icon,
            spent: c.total,
            budget: c.budget,
            over: c.total >= c.budget,
            pct: Math.round((c.total / c.budget) * 100),
          }))
      : [],
  [categoryTotals, currentDate, budgetList])

  const dailyData = useMemo(() => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const byDate = new Map<string, number>()
    transactions.filter(t => t.type === 'expense').forEach(t => {
      byDate.set(t.date, (byDate.get(t.date) || 0) + t.amount_krw)
    })
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${currentDate.toISOString().slice(0, 7)}-${day.toString().padStart(2, '0')}`
      return { day: day.toString(), expense: byDate.get(dateStr) || 0 }
    })
  }, [transactions, currentDate])

  const fmt = useCallback(
    (amount: number) => showUSD ? formatUSD(amount / liveRate) : formatKRW(amount),
    [showUSD, liveRate]
  )

  return (
    <div className="mx-auto w-full max-w-[1240px] overflow-x-hidden px-0 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10 lg:pt-10">
      {/* ─── Top Header ─── */}
      <div className="mb-7 flex items-center justify-between gap-4 px-5 sm:mb-8 sm:px-0">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/settings" aria-label="Open profile settings" className="rounded-full transition-transform active:scale-95">
            <Avatar src={avatarUrl} name={userName} size={48} className="shrink-0 shadow-lg ring-2 ring-[var(--color-border-base)]" />
          </Link>
          <div className="min-w-0">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-0.5 text-sm font-medium text-[var(--color-text-secondary)]">
              {greeting}
            </motion.p>
            <motion.h1 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {userName}
            </motion.h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => { haptic('light'); setShowUSD(!showUSD) }}
            className="glass-morphic rounded-xl border border-[var(--color-border-base)] px-3 py-2 text-xs font-bold transition-transform active:scale-95"
            aria-label={`Display amounts in ${showUSD ? 'Korean won' : 'US dollars'}`}
          >
            {showUSD ? 'USD' : 'KRW'}
          </button>
          <ChatBot />
          <Link href="/settings" aria-label="Open settings" className="glass-morphic flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border-base)] transition-transform active:scale-95 lg:hidden">
            <Settings size={17} className="text-[var(--color-text-secondary)]" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 xl:gap-10">
        
        {/* ─── LEFT COLUMN ─── */}
        <div className="space-y-7 sm:space-y-8">
          <SummaryCards 
            balance={balance} 
            totalIncome={totalIncome} 
            totalExpense={totalExpense} 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate} 
            fmt={fmt} 
          />

          <DailyBudgetPill dailyBudgetRemaining={dailyBudgetRemaining} loading={loading} fmt={fmt} />
          
          <BudgetReviewPrompt show={showBudgetReview} onDismiss={dismissBudgetReview} />

          <AnalyticsTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            dailyData={dailyData}
            categoryTotals={categoryTotals}
            isDesktop={isDesktop}
            fmt={fmt}
          >
            <div className="space-y-7 sm:space-y-8">
              <div className="lg:hidden">
                <RecentActivity transactions={transactions} fmt={fmt} />
              </div>

              {totalIncome > 0 && (
                <div className="group relative overflow-hidden rounded-[28px] border border-[var(--color-border-base)] bg-[var(--color-card-base)] p-6 shadow-lg sm:p-7">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Income spent</span>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)] opacity-75">How much of this month’s income has been used</p>
                    </div>
                    <span className="shrink-0 text-2xl font-bold tabular-nums sm:text-3xl">{Math.round((totalExpense / totalIncome) * 100)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--color-card-elevated-base)] p-0.5">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }} 
                      className={`h-full rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-1000 ${
                        totalExpense/totalIncome > 0.8 ? 'bg-rose-500' : 'bg-blue-500'
                      }`} 
                    />
                  </div>
                  <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
                    {fmt(Math.max(0, totalIncome - totalExpense))} remains after expenses
                  </p>
                </div>
              )}
            </div>
          </AnalyticsTabs>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="mt-10 space-y-8 lg:sticky lg:top-8 lg:mt-0 lg:h-fit">
          <Intelligence insights={insights} totalIncome={totalIncome} fmt={fmt} handleQuickAdd={handleQuickAdd} />

          <div className="px-5 sm:px-0">
            <button
              onClick={() => router.push('/analytics')}
              className="group flex w-full items-center gap-4 rounded-[24px] border border-[var(--color-border-base)] bg-[var(--color-card-base)] p-4 text-left transition-[border-color,transform] hover:border-[color-mix(in_srgb,var(--color-accent-base)_35%,transparent)] active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/10 group-hover:scale-110 transition-transform">
                <FileText size={20} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold tracking-tight">View all analytics</p>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Trends and monthly summary</p>
              </div>
              <ChevronRight size={18} className="opacity-20 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="hidden lg:block">
            <RecentActivity transactions={transactions} fmt={fmt} limit={6} />
          </div>

          <BudgetAlerts alerts={budgetAlerts} dismissed={alertsDismissed} onDismiss={() => setAlertsDismissed(true)} />
        </div>
      </div>

      <FAB onClick={() => setShowAddSheet(true)} />
      <AddTransactionSheet isOpen={showAddSheet} onClose={() => setShowAddSheet(false)} onSuccess={() => { void loadData() }} />
    </div>
  )
}
