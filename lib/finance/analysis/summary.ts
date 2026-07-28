import { money, sumMoney, roundKRW, pct, safeDiv } from './money'
import { normalizeDescription } from './normalize'
import type {
  EngineTransaction,
  EngineBudget,
  CategoryBreakdownEntry,
  PaymentMethodBreakdownEntry,
  SmallTransactionBucket,
  MonthOverMonthChange,
  BudgetUsageEntry,
  DailyPaceResult,
  TopDescriptionEntry,
  PeriodTotals,
} from './types'
import Decimal from 'decimal.js'

const UNCATEGORIZED = 'Uncategorized'
const UNKNOWN_PAYMENT_METHOD = 'Unknown method'

export function filterByPeriod(transactions: EngineTransaction[], from: string, to: string): EngineTransaction[] {
  return transactions.filter((t) => t.date >= from && t.date <= to)
}

export function computePeriodTotals(transactions: EngineTransaction[], from: string, to: string): PeriodTotals {
  const inPeriod = filterByPeriod(transactions, from, to)
  const totalIncome = sumMoney(inPeriod.filter((t) => t.type === 'income').map((t) => t.amount_krw))
  const totalExpense = sumMoney(inPeriod.filter((t) => t.type === 'expense').map((t) => t.amount_krw))
  const net = totalIncome.minus(totalExpense)

  return {
    from,
    to,
    totalIncomeKrw: roundKRW(totalIncome),
    totalExpenseKrw: roundKRW(totalExpense),
    netCashFlowKrw: roundKRW(net),
    savingsRatePct: totalIncome.isZero() ? 0 : pct(net, totalIncome),
    transactionCount: inPeriod.length,
  }
}

export function computeCategoryBreakdown(
  transactions: EngineTransaction[],
  type: 'income' | 'expense' = 'expense'
): CategoryBreakdownEntry[] {
  const relevant = transactions.filter((t) => t.type === type)
  const total = sumMoney(relevant.map((t) => t.amount_krw))

  const map = new Map<string, { name: string; total: Decimal; count: number; id: string | null }>()
  for (const t of relevant) {
    const key = t.category_id ?? '__uncategorized__'
    const existing = map.get(key) ?? { name: t.category_name ?? UNCATEGORIZED, total: new Decimal(0), count: 0, id: t.category_id }
    existing.total = existing.total.plus(money(t.amount_krw))
    existing.count += 1
    map.set(key, existing)
  }

  return Array.from(map.values())
    .map((entry) => ({
      category_id: entry.id,
      category_name: entry.name,
      totalKrw: roundKRW(entry.total),
      pctOfTotal: pct(entry.total, total),
      transactionCount: entry.count,
    }))
    .sort((a, b) => b.totalKrw - a.totalKrw)
}

export function computePaymentMethodBreakdown(transactions: EngineTransaction[]): PaymentMethodBreakdownEntry[] {
  const expenses = transactions.filter((t) => t.type === 'expense')
  const total = sumMoney(expenses.map((t) => t.amount_krw))

  const map = new Map<string, { name: string; total: Decimal; count: number; id: string | null }>()
  for (const t of expenses) {
    const key = t.payment_method_id ?? '__unknown__'
    const existing = map.get(key) ?? {
      name: t.payment_method_name ?? UNKNOWN_PAYMENT_METHOD,
      total: new Decimal(0),
      count: 0,
      id: t.payment_method_id,
    }
    existing.total = existing.total.plus(money(t.amount_krw))
    existing.count += 1
    map.set(key, existing)
  }

  return Array.from(map.values())
    .map((entry) => ({
      payment_method_id: entry.id,
      payment_method_name: entry.name,
      totalKrw: roundKRW(entry.total),
      pctOfTotal: pct(entry.total, total),
      transactionCount: entry.count,
    }))
    .sort((a, b) => b.totalKrw - a.totalKrw)
}

const SMALL_TX_BUCKET_DEFS: Array<{ label: string; minKrw: number; maxKrw: number | null }> = [
  { label: '₩0 – ₩5,000', minKrw: 0, maxKrw: 5000 },
  { label: '₩5,001 – ₩10,000', minKrw: 5001, maxKrw: 10000 },
  { label: '₩10,001 – ₩30,000', minKrw: 10001, maxKrw: 30000 },
  { label: 'Over ₩30,000', minKrw: 30001, maxKrw: null },
]

export function computeSmallTransactionBuckets(transactions: EngineTransaction[]): SmallTransactionBucket[] {
  const expenses = transactions.filter((t) => t.type === 'expense')
  return SMALL_TX_BUCKET_DEFS.map((def) => {
    const inBucket = expenses.filter((t) => t.amount_krw >= def.minKrw && (def.maxKrw === null || t.amount_krw <= def.maxKrw))
    return {
      label: def.label,
      minKrw: def.minKrw,
      maxKrw: def.maxKrw,
      count: inBucket.length,
      totalKrw: roundKRW(sumMoney(inBucket.map((t) => t.amount_krw))),
    }
  })
}

export function computeTopDescriptions(transactions: EngineTransaction[], limit = 5): TopDescriptionEntry[] {
  const expenses = transactions.filter((t) => t.type === 'expense')
  const map = new Map<string, { sample: string; total: Decimal; count: number }>()

  for (const t of expenses) {
    const normalized = normalizeDescription(t.description || '')
    if (!normalized) continue
    const existing = map.get(normalized) ?? { sample: t.description, total: new Decimal(0), count: 0 }
    existing.total = existing.total.plus(money(t.amount_krw))
    existing.count += 1
    map.set(normalized, existing)
  }

  return Array.from(map.entries())
    .map(([normalizedDescription, entry]) => ({
      normalizedDescription,
      sampleDescription: entry.sample,
      totalKrw: roundKRW(entry.total),
      transactionCount: entry.count,
    }))
    .sort((a, b) => b.totalKrw - a.totalKrw)
    .slice(0, limit)
}

export function computeMonthOverMonthChange(currentKrw: number, previousKrw: number): MonthOverMonthChange {
  const current = money(currentKrw)
  const previous = money(previousKrw)
  const delta = current.minus(previous)

  let direction: MonthOverMonthChange['direction'] = 'unknown'
  if (previous.isZero() && current.isZero()) direction = 'flat'
  else if (previous.isZero()) direction = 'unknown' // no baseline to compare against
  else if (delta.greaterThan(0)) direction = 'up'
  else if (delta.lessThan(0)) direction = 'down'
  else direction = 'flat'

  return {
    currentKrw: roundKRW(current),
    previousKrw: roundKRW(previous),
    deltaKrw: roundKRW(delta),
    deltaPct: previous.isZero() ? null : pct(delta, previous),
    direction,
  }
}

export function computeBudgetUsage(
  transactions: EngineTransaction[],
  budgets: EngineBudget[],
  monthStart: string,
  monthEndExclusive: string
): BudgetUsageEntry[] {
  const inMonth = transactions.filter((t) => t.type === 'expense' && t.date >= monthStart && t.date < monthEndExclusive)
  const spentByCategory = new Map<string, Decimal>()
  for (const t of inMonth) {
    if (!t.category_id) continue
    spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? new Decimal(0)).plus(money(t.amount_krw)))
  }

  return budgets.map((b) => {
    const spent = spentByCategory.get(b.category_id) ?? new Decimal(0)
    const budget = money(b.amount_krw)
    const remaining = budget.minus(spent)
    return {
      category_id: b.category_id,
      category_name: b.category_name,
      budgetKrw: roundKRW(budget),
      spentKrw: roundKRW(spent),
      remainingKrw: roundKRW(remaining),
      usagePct: pct(spent, budget),
      overBudget: spent.greaterThan(budget) && budget.greaterThan(0),
    }
  })
}

export function computeDailyPace(
  transactions: EngineTransaction[],
  year: number,
  month: number, // 1-indexed
  today: Date = new Date()
): DailyPaceResult {
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const daysPassed = isCurrentMonth ? today.getDate() : daysInMonth
  const daysRemaining = isCurrentMonth ? Math.max(daysInMonth - today.getDate(), 0) : 0

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const inMonth = transactions.filter((t) => t.type === 'expense' && t.date.startsWith(monthStr))
  const totalExpense = sumMoney(inMonth.map((t) => t.amount_krw))
  const dailyAvg = safeDiv(totalExpense, daysPassed)
  const projected = isCurrentMonth ? totalExpense.plus(dailyAvg.times(daysRemaining)) : totalExpense

  return {
    daysPassed,
    daysInMonth,
    daysRemaining,
    dailyAvgKrw: roundKRW(dailyAvg),
    projectedEndOfMonthKrw: roundKRW(projected),
    isCurrentMonth,
    isPartialMonth: isCurrentMonth && daysPassed < daysInMonth,
  }
}

export interface MonthlyIncomePoint {
  month: string // YYYY-MM
  incomeKrw: number
  isComplete: boolean
}

// Buckets income transactions by month. A month is "complete" if it isn't
// the current calendar month (handles partial-current-month and multiple
// income payments per month automatically via summation).
export function computeMonthlyIncomeSeries(transactions: EngineTransaction[], referenceDate: Date = new Date()): MonthlyIncomePoint[] {
  const currentMonthKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`
  const map = new Map<string, Decimal>()

  for (const t of transactions) {
    if (t.type !== 'income') continue
    const monthKey = t.date.slice(0, 7)
    map.set(monthKey, (map.get(monthKey) ?? new Decimal(0)).plus(money(t.amount_krw)))
  }

  return Array.from(map.entries())
    .map(([month, total]) => ({ month, incomeKrw: roundKRW(total), isComplete: month < currentMonthKey }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export interface IncomeBaselineResult {
  averageMonthlyIncomeKrw: number
  conservativeBaselineKrw: number
  monthsUsed: number
  basedOnPartialData: boolean
}

// "Conservative income baseline" = average over recent *complete* months only,
// so a partial current month never inflates the number the rest of the
// engine budgets against. Falls back to whatever data exists (flagged) when
// there is no complete month yet.
export function computeIncomeBaseline(series: MonthlyIncomePoint[], lookbackMonths = 6): IncomeBaselineResult {
  const completeMonths = series.filter((m) => m.isComplete).slice(-lookbackMonths)

  if (completeMonths.length > 0) {
    const total = sumMoney(completeMonths.map((m) => m.incomeKrw))
    const avg = safeDiv(total, completeMonths.length)
    return {
      averageMonthlyIncomeKrw: roundKRW(avg),
      conservativeBaselineKrw: roundKRW(avg),
      monthsUsed: completeMonths.length,
      basedOnPartialData: false,
    }
  }

  // No complete months yet (brand new account) — use whatever partial data
  // exists as a rough, explicitly-flagged estimate.
  if (series.length > 0) {
    const total = sumMoney(series.map((m) => m.incomeKrw))
    const avg = safeDiv(total, series.length)
    return {
      averageMonthlyIncomeKrw: roundKRW(avg),
      conservativeBaselineKrw: roundKRW(avg),
      monthsUsed: series.length,
      basedOnPartialData: true,
    }
  }

  return { averageMonthlyIncomeKrw: 0, conservativeBaselineKrw: 0, monthsUsed: 0, basedOnPartialData: true }
}
