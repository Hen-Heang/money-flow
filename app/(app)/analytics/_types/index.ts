import type { Budget } from '@/lib/types'

// Analytics budget needs the extra categories join field
export interface AnalyticsBudget extends Budget {
  categories?: { name: string; icon: string; color: string } | null
}

export type Period = '1M' | '3M' | '6M'
export const PERIOD_MONTHS: Record<Period, number> = { '1M': 1, '3M': 3, '6M': 6 }

export interface MonthSummary {
  income: number
  expense: number
  txCount: number
  topCategories: { name: string; icon: string; color: string; total: number }[]
}

export type View = 'trends' | 'monthly'

export interface CategoryTotal {
  name: string
  icon: string
  color: string
  total: number
}

export interface BudgetComparisonRow {
  cat: { name: string; icon: string; color: string } | null
  spent: number
  budget: number
  pct: number
  over: boolean
}

export interface CategoryForecastRow {
  cat: { name: string; icon: string; color: string }
  projected: number
  budget: number
  pct: number
  over: boolean
}

export interface AnalyticsForecast {
  dayOfMonth: number
  daysInMonth: number
  daysRemaining: number
  dailyRate: number
  projectedSpend: number
  thisMonthSpend: number
  thisMonthIncome: number
  projectedVsBudget: number | null
  totalBudgetKrw: number
  categoryForecast: CategoryForecastRow[]
}

export interface AnalyticsDerived {
  monthlyData: { month: string; income: number; expense: number }[]
  netFlowData: { month: string; net: number }[]
  categoryData: CategoryTotal[]
  categoryMap: Record<string, CategoryTotal>
  prevCatMap: Record<string, number>
  budgetComparison: BudgetComparisonRow[]
  overBudgetCount: number
  totalIncome: number
  totalExpense: number
  avgMonthly: number
  savingsRate: string
  prevIncome: number
  prevExpense: number
  prevSavings: number
  curSavings: number
  paymentMethodData: { name: string; icon: string; total: number }[]
  forecast: AnalyticsForecast
}
