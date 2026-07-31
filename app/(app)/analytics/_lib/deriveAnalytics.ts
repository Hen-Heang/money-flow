import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns'
import type { Transaction } from '@/lib/types'
import type { AnalyticsBudget, AnalyticsDerived, CategoryTotal } from '../_types'

export function delta(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

/**
 * Pure derivation of every chart/summary value the Trends view needs from
 * the raw transactions/budgets for the selected period. Extracted from the
 * page component so it can be unit tested without React or Supabase.
 */
export function deriveAnalytics(
  transactions: Transaction[],
  budgets: AnalyticsBudget[],
  periodMonths: number,
  now: Date = new Date(),
): AnalyticsDerived {
  const n = periodMonths
  const periodStart = startOfMonth(subMonths(now, n - 1))
  const prevStart = startOfMonth(subMonths(now, 2 * n - 1))
  const prevEnd = endOfMonth(subMonths(now, n))
  const periodStartStr = format(periodStart, 'yyyy-MM-dd')
  const prevStartStr = format(prevStart, 'yyyy-MM-dd')
  const prevEndStr = format(prevEnd, 'yyyy-MM-dd')

  const periodTxns = transactions.filter(t => t.date >= periodStartStr)
  const prevPeriodTxns = transactions.filter(t => t.date >= prevStartStr && t.date <= prevEndStr)

  // Bar chart — group by month in a single pass
  const monthMap = new Map<string, { income: number; expense: number; label: string }>()
  for (let i = 0; i < n; i++) {
    const m = subMonths(now, n - 1 - i)
    monthMap.set(format(m, 'yyyy-MM'), { income: 0, expense: 0, label: format(m, n === 1 ? 'MMM yyyy' : 'MMM') })
  }
  transactions.forEach(t => {
    const key = t.date.slice(0, 7)
    const entry = monthMap.get(key)
    if (!entry) return
    if (t.type === 'income') entry.income += t.amount_krw
    else entry.expense += t.amount_krw
  })
  const monthlyData = Array.from(monthMap.values()).map(({ label, income, expense }) => ({ month: label, income, expense }))
  const netFlowData = monthlyData.map(m => ({ month: m.month, net: m.income - m.expense }))

  // Category breakdown
  const categoryMap: Record<string, CategoryTotal> = {}
  periodTxns.filter(t => t.type === 'expense' && t.categories).forEach(t => {
    const cat = t.categories!
    if (!categoryMap[cat.name]) categoryMap[cat.name] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0 }
    categoryMap[cat.name].total += t.amount_krw
  })
  const categoryData = Object.values(categoryMap).sort((a, b) => b.total - a.total)

  const prevCatMap: Record<string, number> = {}
  prevPeriodTxns.filter(t => t.type === 'expense' && t.categories).forEach(t => {
    const name = (t.categories as { name: string }).name
    prevCatMap[name] = (prevCatMap[name] || 0) + t.amount_krw
  })

  // Budget vs Actual
  const thisMonthStr = format(now, 'yyyy-MM')
  const thisMonthExpenseMap = new Map<string, number>()
  transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'expense' && t.category_id).forEach(t => {
    thisMonthExpenseMap.set(t.category_id!, (thisMonthExpenseMap.get(t.category_id!) ?? 0) + t.amount_krw)
  })
  const budgetComparison = budgets
    .map(b => {
      const cat = b.categories as { name: string; icon: string; color: string } | null
      const spent = thisMonthExpenseMap.get(b.category_id) ?? 0
      const pct = b.amount_krw > 0 ? Math.min((spent / b.amount_krw) * 100, 100) : 0
      return { cat, spent, budget: b.amount_krw, pct, over: spent > b.amount_krw }
    })
    .filter(b => b.cat)
    .sort((a, b) => b.pct - a.pct)
  const overBudgetCount = budgetComparison.filter(b => b.over).length

  // Summary stats
  const totalIncome = periodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense = periodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const avgMonthly = n > 0 ? totalExpense / n : 0
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : '0'
  const prevIncome = prevPeriodTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const prevExpense = prevPeriodTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const prevSavings = prevIncome > 0 ? (prevIncome - prevExpense) / prevIncome * 100 : 0
  const curSavings = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome * 100 : 0

  // Payment method breakdown
  const pmMap: Record<string, { name: string; icon: string; total: number }> = {}
  periodTxns.filter(t => t.type === 'expense').forEach(t => {
    const pm = t.payment_methods
    const key = pm ? pm.name : 'Other'
    const icon = pm ? pm.icon : '💳'
    if (!pmMap[key]) pmMap[key] = { name: key, icon, total: 0 }
    pmMap[key].total += t.amount_krw
  })
  const paymentMethodData = Object.values(pmMap).sort((a, b) => b.total - a.total)

  // Forecast — current month only
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - dayOfMonth
  const thisMonthSpend = transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const thisMonthIncome = transactions.filter(t => t.date.startsWith(thisMonthStr) && t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const dailyRate = dayOfMonth > 0 ? thisMonthSpend / dayOfMonth : 0
  const projectedSpend = dailyRate * daysInMonth
  const totalBudgetKrw = budgets.reduce((s, b) => s + b.amount_krw, 0)
  const projectedVsBudget = totalBudgetKrw > 0 ? projectedSpend - totalBudgetKrw : null
  // Per-category budget projections
  const categoryForecast = budgets
    .map(b => {
      const cat = b.categories as { name: string; icon: string; color: string } | null
      if (!cat) return null
      const spentSoFar = thisMonthExpenseMap.get(b.category_id) ?? 0
      const catDailyRate = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0
      const catProjected = catDailyRate * daysInMonth
      const pct = b.amount_krw > 0 ? (catProjected / b.amount_krw) * 100 : 0
      return { cat, projected: catProjected, budget: b.amount_krw, pct, over: catProjected > b.amount_krw }
    })
    .filter(Boolean)
    .sort((a, b) => b!.pct - a!.pct) as { cat: { name: string; icon: string; color: string }; projected: number; budget: number; pct: number; over: boolean }[]

  return {
    monthlyData,
    netFlowData,
    categoryData,
    categoryMap,
    prevCatMap,
    budgetComparison,
    overBudgetCount,
    totalIncome,
    totalExpense,
    avgMonthly,
    savingsRate,
    prevIncome,
    prevExpense,
    prevSavings,
    curSavings,
    paymentMethodData,
    forecast: {
      dayOfMonth,
      daysInMonth,
      daysRemaining,
      dailyRate,
      projectedSpend,
      thisMonthSpend,
      thisMonthIncome,
      projectedVsBudget,
      totalBudgetKrw,
      categoryForecast,
    },
  }
}
