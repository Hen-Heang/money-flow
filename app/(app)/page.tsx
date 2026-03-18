'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, differenceInDays } from 'date-fns'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Lightbulb, Coffee, Utensils, Bus, ShoppingBag, Sparkles, ChevronRight as ChevronIcon
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { getUserProfile } from '@/lib/profile'
import Avatar from '@/components/ui/Avatar'
import { formatKRW, formatUSD, getDisplayName, getGreeting, haptic } from '@/lib/utils'
import FAB from '@/components/ui/FAB'
import AddTransactionSheet from '@/components/transactions/AddTransactionSheet'
import ChatBot from '@/components/ai/ChatBot'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

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
  name: string;
  icon: string;
  color: string;
  total: number;
  budget?: number;
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
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'categories'>('overview')
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showUSD, setShowUSD] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [exchangeRateInfo, setExchangeRateInfo] = useState<ExchangeRateInfo | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
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
    loadData()
  }, [loadData])

  useEffect(() => {
    let active = true
    const loadExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate', { cache: 'no-store' })
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
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const balance = totalIncome - totalExpense
  const liveRate = exchangeRateInfo?.rate || 1350

  const insights = useMemo(() => {
    const today = new Date()
    const daysPassed = isSameMonth(currentDate, today) ? today.getDate() : differenceInDays(endOfMonth(currentDate), startOfMonth(currentDate)) + 1
    const dailyAvg = totalExpense / Math.max(daysPassed, 1)
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
    return { dailyAvg, savingsRate }
  }, [totalExpense, totalIncome, currentDate])

  const categoryTotals: CategoryTotal[] = []
  transactions.filter(t => t.type === 'expense' && t.categories).forEach(t => {
    const cat = t.categories!
    const existing = categoryTotals.find(c => c.name === cat.name)
    if (existing) existing.total += t.amount_krw
    else categoryTotals.push({ name: cat.name, icon: cat.icon, color: cat.color, total: t.amount_krw, budget: t.category_id ? budgetMap[t.category_id] : undefined })
  })
  categoryTotals.sort((a, b) => b.total - a.total)

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
    <div className="w-full max-w-full md:max-w-3xl md:mx-auto pt-4 pb-24 md:pt-10 overflow-x-hidden">
      {/* Header */}
      <div className="px-5 mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={avatarUrl} name={userName} size={36} className="ring-2 ring-[var(--color-border-base)] shadow-xl shrink-0 sm:w-12 sm:h-12" />
          <div className="min-w-0">
            <p className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-[0.15em] truncate opacity-80">{getGreeting()}</p>
            <h1 className="text-sm sm:text-lg font-black tracking-tight truncate">{userName}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
           <button onClick={() => { haptic('light'); setShowUSD(!showUSD) }} className="px-3 py-1.5 rounded-full glass-morphic text-[9px] font-bold active:scale-95 transition-all">
             {showUSD ? '🇺🇸 USD' : '🇰🇷 KRW'}
           </button>
           <ChatBot />
        </div>
      </div>

      {/* Main Stats */}
      <div className="px-5 mb-6">
        <div className="flex flex-col gap-3 mb-6">
          <div className="min-w-0">
            <p className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-[0.2em] font-black mb-1 opacity-60">Available Balance</p>
            <h2 className={`text-3xl sm:text-5xl font-black tracking-tighter truncate leading-none ${balance >= 0 ? 'text-[var(--color-income-base)]' : 'text-[var(--color-expense-base)]'}`}>
              {fmt(balance)}
            </h2>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-tight uppercase">{format(currentDate, 'MMMM yyyy')}</p>
              {exchangeRateInfo && (
                <p className="text-[9px] font-bold text-[var(--color-text-secondary)] tracking-tight opacity-60">
                  1 USD = {new Intl.NumberFormat('ko-KR').format(exchangeRateInfo.rate)} KRW
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { haptic('light'); setCurrentDate(subMonths(currentDate, 1)) }} className="p-2 rounded-xl bg-[var(--color-card-elevated-base)] border border-white/5 active:scale-90 transition-all shadow-lg"><ChevronLeft size={16} /></button>
              <button onClick={() => { haptic('light'); setCurrentDate(addMonths(currentDate, 1)) }} className="p-2 rounded-xl bg-[var(--color-card-elevated-base)] border border-white/5 active:scale-90 transition-all shadow-lg"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-income-base)]/10 border border-[var(--color-income-base)]/20 min-w-0">
             <div className="flex items-center gap-2 mb-1 opacity-60"><TrendingUp size={12} /><span className="text-[9px] font-black uppercase tracking-wider">Income</span></div>
             <p className="text-base font-black text-[var(--color-income-base)] truncate">{fmt(totalIncome)}</p>
          </div>
          <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-expense-base)]/10 border border-[var(--color-expense-base)]/20 min-w-0">
             <div className="flex items-center gap-2 mb-1 opacity-60"><TrendingDown size={12} /><span className="text-[9px] font-black uppercase tracking-wider">Expense</span></div>
             <p className="text-base font-black text-[var(--color-expense-base)] truncate">{fmt(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Smart Insight Card */}
      <div className="px-5 mb-8">
        {!loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 shadow-xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Sparkles size={36} className="sm:w-12 sm:h-12" /></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400"><Lightbulb size={12} /></div>
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">AI Smart Insight</span>
                </div>
              </div>
              
              <div className="space-y-3 mb-4 pr-6">
                <p className="text-xs font-bold leading-snug">
                  {insights.savingsRate > 30 
                    ? "Excellent financial health! Your savings rate is top tier. Consider investing the surplus." 
                    : insights.savingsRate > 15
                    ? "You're building solid wealth. Keep this pace up to reach your goals faster."
                    : insights.dailyAvg > 100000 
                    ? `Daily spending is high at ${fmt(insights.dailyAvg)}. Your ${categoryTotals[0]?.name || 'top'} category is driving this.`
                    : balance < 0
                    ? "Balance is negative. Let's look for small wins to cut back this week."
                    : "Your cash flow is stable. A good time to save or review your monthly budgets."}
                </p>

                {/* Secondary Smart Hint */}
                {categoryTotals.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)] font-medium">
                    <span className="shrink-0">💡</span>
                    <p className="truncate">
                      {categoryTotals[0].budget && categoryTotals[0].total > categoryTotals[0].budget
                        ? `You've exceeded your ${categoryTotals[0].name} budget.`
                        : `Most of your budget is going to ${categoryTotals[0].name} this month.`}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-[10px] sm:text-xs text-[var(--color-text-secondary)] font-medium">
                  Status: <span className={`${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-black`}>{balance >= 0 ? 'POSITIVE' : 'OVERSPENT'}</span>
                </p>
                <button 
                  onClick={() => {
                    haptic('medium');
                    toast.success('Open Chat Assistant for a deep dive!');
                  }}
                  className="flex items-center gap-1 text-[10px] font-black text-blue-400 uppercase tracking-wider"
                >
                  Analyze <ChevronIcon size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Add - Edge to Edge Swiping */}
      {!loading && (
        <div className="mb-10 overflow-x-auto no-scrollbar -mx-0">
          <div className="flex gap-3 px-5 py-1">
            {QUICK_TEMPLATES.map(t => (
              <motion.button key={t.name} whileTap={{ scale: 0.94 }} onClick={() => handleQuickAdd(t)} className="flex items-center gap-3 px-5 py-3.5 rounded-full bg-[var(--color-card-elevated-base)] border border-white/5 shadow-lg shrink-0 active:bg-blue-500/10 transition-colors">
                <span className="text-xl">{t.iconEmoji}</span>
                <span className="text-sm font-black whitespace-nowrap uppercase tracking-wider">{t.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tabs - Full Width Scrollable */}
      <div className="px-5 mb-8">
        <div className="flex gap-6 sm:gap-10 border-b border-white/5 mb-8 overflow-x-auto no-scrollbar">
          {(['overview', 'trends', 'categories'] as const).map(tab => (
            <button key={tab} onClick={() => { haptic('light'); setActiveTab(tab) }} className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] relative transition-all whitespace-nowrap ${activeTab === tab ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] opacity-40'}`}>
              {tab}
              {activeTab === tab && <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-accent-base)] rounded-full shadow-[0_0_8px_var(--color-accent-base)]" />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Unified Recent Activity */}
                <div className="card-premium shadow-2xl">
                  <div className="p-6 flex items-center justify-between border-b border-white/5">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Recent Activity</h3>
                    <button onClick={() => router.push('/transactions')} className="text-[10px] font-black text-[var(--color-accent-base)] uppercase tracking-[0.1em] px-3 py-1 rounded-lg bg-blue-500/10">VIEW ALL</button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {transactions.slice(0, 5).map(t => (
                      <div key={t.id} className="p-6 flex items-center gap-4 hover:bg-white/[0.02] transition-colors active:bg-white/[0.04]">
                        <div className={`w-12 h-12 rounded-button flex items-center justify-center text-2xl shadow-inner shrink-0 ${t.type === 'income' ? 'bg-[var(--color-income-base)]/10' : 'bg-[var(--color-expense-base)]/10'}`}>
                          {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base truncate">{t.description}</p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider opacity-60">{format(new Date(t.date), 'MMM d')} • {t.categories?.name}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`font-black text-base ${t.type === 'income' ? 'text-[var(--color-income-base)]' : 'text-[var(--color-text-primary)]'}`}>
                            {t.type === 'income' ? '+' : ''}{fmt(t.amount_krw)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simple Budget Pill */}
                {totalIncome > 0 && (
                  <div className="p-6 rounded-[32px] bg-[var(--color-card-elevated-base)] border border-white/5 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-50">Monthly Budget Usage</span>
                      <span className="text-sm font-black tracking-tighter">{Math.round((totalExpense / totalIncome) * 100)}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-black/30 overflow-hidden p-0.5 border border-white/5">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }} className={`h-full rounded-full shadow-[0_0_12px_rgba(0,0,0,0.5)] ${totalExpense/totalIncome > 0.8 ? 'bg-[var(--color-expense-base)]' : 'bg-[var(--color-accent-base)]'}`} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="card-premium p-6 sm:p-8">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-8 opacity-50 text-center">Daily Spending Flow</h3>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-accent-base)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--color-accent-base)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-base)" opacity={0.3} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--color-text-secondary)' }} interval={4} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--color-text-secondary)' }}
                        width={40}
                        tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)}
                      />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-card-elevated-base)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', fontWeight: 900 }} />
                      <Area type="monotone" dataKey="expense" stroke="var(--color-accent-base)" strokeWidth={5} fill="url(#trendGrad)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="card-premium p-6 sm:p-8">
                 <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-8 opacity-50 text-center">Spending Breakdown</h3>
                 <div className="flex flex-col items-center gap-10">
                    <div className="w-full h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryTotals} dataKey="total" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={8} animationBegin={0} animationDuration={1200}>
                            {categoryTotals.map((entry, index) => <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} stroke="none" className="hover:opacity-80 transition-opacity outline-none" />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full space-y-3">
                      {categoryTotals.map((cat, i) => (
                        <div key={cat.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 active:bg-white/5 transition-colors">
                          <div className="flex items-center gap-4 min-w-0">
                             <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: cat.color || COLORS[i % COLORS.length] }} />
                             <span className="text-base font-bold truncate tracking-tight">{cat.icon} {cat.name}</span>
                          </div>
                          <span className="text-base font-black shrink-0 ml-2 tracking-tighter">{fmt(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <FAB onClick={() => setShowAddSheet(true)} />
      <AddTransactionSheet isOpen={showAddSheet} onClose={() => setShowAddSheet(false)} onSuccess={() => loadData()} />
    </div>
  )
}
