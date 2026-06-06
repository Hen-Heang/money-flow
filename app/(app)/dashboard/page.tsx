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

interface CategoryTotal {
  name: string
  icon: string
  color: string
  total: number
}

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
      const { data: { user } } = await supabase.auth.getUser()
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
    } catch (err) {
      toast.error('Failed to sync data')
    } finally {
      setLoading(false)
    }
  }, [currentDate, supabase, router])

  useEffect(() => {
    setGreeting(getGreeting())
    loadData()
  }, [loadData])

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
      date: new Date().toISOString().slice(0, 10),
      category_id: category?.id || null,
      currency: 'KRW'
    }
    const { error } = await supabase.from('transactions').insert(payload)
    if (error) { toast.error('Quick Add failed'); return }
    toast.success(`Logged ${template.iconEmoji} ${template.name}`)
    loadData()
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
    <div className="w-full max-w-full lg:max-w-6xl xl:max-w-7xl mx-auto pt-6 pb-24 md:pt-12 px-0 sm:px-6 lg:px-10 overflow-x-hidden">
      {/* ─── Top Header ─── */}
      <div className="px-5 sm:px-0 mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/settings" className="active:scale-95 transition-transform">
            <Avatar src={avatarUrl} name={userName} size={48} className="ring-4 ring-white/5 shadow-2xl shrink-0 sm:w-16 sm:h-16" />
          </Link>
          <div className="min-w-0">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-xs text-[var(--color-text-secondary)] font-black tracking-[0.3em] mb-1 uppercase">
              {greeting}
            </motion.p>
            <motion.h1 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-2xl sm:text-4xl font-black tracking-tight truncate">
              {userName}
            </motion.h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button onClick={() => { haptic('light'); setShowUSD(!showUSD) }} className="px-4 py-2 rounded-2xl glass-morphic text-tiny font-black active:scale-95 transition-all border border-white/5">
            {showUSD ? '🇺🇸 USD' : '🇰🇷 KRW'}
          </button>
          <ChatBot />
          <Link href="/settings" className="md:hidden w-9 h-9 rounded-2xl glass-morphic border border-white/5 flex items-center justify-center active:scale-95 transition-transform">
            <Settings size={16} className="text-white/60" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] lg:gap-12 xl:gap-16">
        
        {/* ─── LEFT COLUMN ─── */}
        <div className="space-y-10">
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
            <div className="space-y-10">
              <div className="lg:hidden">
                <RecentActivity transactions={transactions} fmt={fmt} />
              </div>

              {totalIncome > 0 && (
                <div className="p-7 sm:p-10 rounded-[32px] sm:rounded-[40px] bg-[var(--color-card-elevated-base)] border border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Capital Utilization</span>
                    <span className="text-xl sm:text-2xl font-black tracking-tighter">{Math.round((totalExpense / totalIncome) * 100)}% Used</span>
                  </div>
                  <div className="h-4 sm:h-5 rounded-full bg-black/40 overflow-hidden p-1 border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }} 
                      className={`h-full rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-1000 ${
                        totalExpense/totalIncome > 0.8 ? 'bg-rose-500' : 'bg-blue-500'
                      }`} 
                    />
                  </div>
                  <p className="mt-5 text-sm text-[var(--color-text-secondary)] font-bold text-center opacity-50 tracking-tight">
                    Remaining cash flow: {fmt(Math.max(0, totalIncome - totalExpense))}
                  </p>
                </div>
              )}
            </div>
          </AnalyticsTabs>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="lg:sticky lg:top-28 lg:h-fit space-y-10 mt-14 lg:mt-0">
          <Intelligence insights={insights} totalIncome={totalIncome} fmt={fmt} handleQuickAdd={handleQuickAdd} />

          <div className="px-5 sm:px-0">
            <button
              onClick={() => router.push('/analytics')}
              className="w-full flex items-center gap-4 p-5 rounded-[28px] border border-white/5 hover:border-white/20 transition-all active:scale-[0.98] text-left bg-[var(--color-card-elevated-base)] group"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/10 group-hover:scale-110 transition-transform">
                <FileText size={20} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black tracking-tight">Analytics</p>
                <p className="text-sm font-bold opacity-30 mt-0.5">Trends & Monthly Summary</p>
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
