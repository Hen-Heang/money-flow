// Input/output shapes for the deterministic finance analysis engine.
// The engine is pure — it never fetches data itself. Callers (API routes,
// server components) load rows from Supabase and pass plain objects in.

export interface EngineTransaction {
  id: string
  date: string // YYYY-MM-DD
  type: 'income' | 'expense'
  amount_krw: number
  amount_usd: number
  currency: string
  category_id: string | null
  category_name: string | null
  payment_method_id: string | null
  payment_method_name: string | null
  description: string
}

export interface EngineBudget {
  category_id: string
  category_name: string
  amount_krw: number
}

export interface EngineSavingsGoal {
  id: string
  name: string
  target_usd: number
  current_usd: number
  deadline: string | null // YYYY-MM-DD
  auto_monthly_usd: number
  purpose: string | null
}

export interface EngineSavingsContribution {
  goal_id: string
  amount_usd: number
  contribution_month: string // YYYY-MM
  source: 'manual' | 'planned'
  created_at: string
}

export type GoalStatus = 'achieved' | 'on_track' | 'at_risk' | 'off_track' | 'no_deadline' | 'no_data'

export interface CategoryBreakdownEntry {
  category_id: string | null
  category_name: string
  totalKrw: number
  pctOfTotal: number
  transactionCount: number
}

export interface PaymentMethodBreakdownEntry {
  payment_method_id: string | null
  payment_method_name: string
  totalKrw: number
  pctOfTotal: number
  transactionCount: number
}

export interface SmallTransactionBucket {
  label: string
  minKrw: number
  maxKrw: number | null
  count: number
  totalKrw: number
}

export interface MonthOverMonthChange {
  currentKrw: number
  previousKrw: number
  deltaKrw: number
  deltaPct: number | null
  direction: 'up' | 'down' | 'flat' | 'unknown'
}

export interface BudgetUsageEntry {
  category_id: string
  category_name: string
  budgetKrw: number
  spentKrw: number
  remainingKrw: number
  usagePct: number
  overBudget: boolean
}

export interface DailyPaceResult {
  daysPassed: number
  daysInMonth: number
  daysRemaining: number
  dailyAvgKrw: number
  projectedEndOfMonthKrw: number
  isCurrentMonth: boolean
  isPartialMonth: boolean
}

export interface TopDescriptionEntry {
  normalizedDescription: string
  sampleDescription: string
  totalKrw: number
  transactionCount: number
}

export interface PeriodTotals {
  from: string
  to: string
  totalIncomeKrw: number
  totalExpenseKrw: number
  netCashFlowKrw: number
  savingsRatePct: number
  transactionCount: number
}
