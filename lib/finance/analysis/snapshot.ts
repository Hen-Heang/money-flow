// Orchestrator: assembles every deterministic calculation into one snapshot.
// This is the ONLY object that should ever be handed to the AI layer, and
// only after passing through `toAISafePayload` — see AI privacy rules in the
// project brief (no user id/email, no DB ids, category names only).

import {
  computePeriodTotals,
  computeCategoryBreakdown,
  computePaymentMethodBreakdown,
  computeSmallTransactionBuckets,
  computeTopDescriptions,
  computeMonthOverMonthChange,
  computeBudgetUsage,
  computeDailyPace,
  computeMonthlyIncomeSeries,
  computeIncomeBaseline,
} from './summary'
import { detectSubscriptionCandidates, type SubscriptionCandidate, type RecurringTemplateHint } from './subscriptions'
import { detectUnusualTransactions, detectPossibleDuplicateTransactions, type UnusualTransaction, type PossibleDuplicateTransaction } from './unusual'
import { computeGoalPlan, detectDoubleCountingWarnings, type GoalPlan, type DoubleCountingWarning } from './goals'
import type {
  EngineTransaction,
  EngineBudget,
  EngineSavingsGoal,
  EngineSavingsContribution,
  PeriodTotals,
  CategoryBreakdownEntry,
  PaymentMethodBreakdownEntry,
  SmallTransactionBucket,
  TopDescriptionEntry,
  MonthOverMonthChange,
  BudgetUsageEntry,
  DailyPaceResult,
} from './types'
import type { IncomeBaselineResult } from './summary'

export interface BuildSnapshotInput {
  transactions: EngineTransaction[]
  budgets: EngineBudget[]
  savingsGoals: EngineSavingsGoal[]
  savingsContributions: EngineSavingsContribution[]
  recurringTemplates?: RecurringTemplateHint[]
  referenceDate?: Date
}

export interface FinancialSnapshot {
  generatedAt: string
  currentMonth: PeriodTotals
  previousMonth: PeriodTotals
  monthOverMonth: MonthOverMonthChange
  categoryBreakdown: CategoryBreakdownEntry[]
  paymentMethodBreakdown: PaymentMethodBreakdownEntry[]
  smallTransactionBuckets: SmallTransactionBucket[]
  topDescriptions: TopDescriptionEntry[]
  dailyPace: DailyPaceResult
  budgetUsage: BudgetUsageEntry[]
  incomeBaseline: IncomeBaselineResult
  subscriptionCandidates: SubscriptionCandidate[]
  unusualTransactions: UnusualTransaction[]
  possibleDuplicates: PossibleDuplicateTransaction[]
  goalPlans: GoalPlan[]
  doubleCountingWarnings: DoubleCountingWarning[]
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endYear = month === 12 ? year + 1 : year
  const endMonth = month === 12 ? 1 : month + 1
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  return { start, end }
}

export function buildFinancialSnapshot(input: BuildSnapshotInput): FinancialSnapshot {
  const referenceDate = input.referenceDate ?? new Date()
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() + 1
  const { start: curStart, end: curEnd } = monthBounds(year, month)
  const prevMonthDate = new Date(year, month - 2, 1)
  const { start: prevStart, end: prevEnd } = monthBounds(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1)

  // computePeriodTotals is inclusive on `to`; monthBounds end is exclusive —
  // shift back one day for an inclusive day-string comparison.
  const currentMonthTotals = computePeriodTotals(input.transactions, curStart, addDaysISO(curEnd, -1))
  const previousMonthTotals = computePeriodTotals(input.transactions, prevStart, addDaysISO(prevEnd, -1))

  const incomeSeries = computeMonthlyIncomeSeries(input.transactions, referenceDate)
  const incomeBaseline = computeIncomeBaseline(incomeSeries)

  const goalPlans = input.savingsGoals.map((g) => computeGoalPlan(g, input.savingsContributions, referenceDate))

  return {
    generatedAt: referenceDate.toISOString(),
    currentMonth: currentMonthTotals,
    previousMonth: previousMonthTotals,
    monthOverMonth: computeMonthOverMonthChange(currentMonthTotals.totalExpenseKrw, previousMonthTotals.totalExpenseKrw),
    categoryBreakdown: computeCategoryBreakdown(
      input.transactions.filter((t) => t.date >= curStart && t.date < curEnd),
      'expense'
    ),
    paymentMethodBreakdown: computePaymentMethodBreakdown(input.transactions.filter((t) => t.date >= curStart && t.date < curEnd)),
    smallTransactionBuckets: computeSmallTransactionBuckets(input.transactions.filter((t) => t.date >= curStart && t.date < curEnd)),
    topDescriptions: computeTopDescriptions(input.transactions.filter((t) => t.date >= curStart && t.date < curEnd)),
    dailyPace: computeDailyPace(input.transactions, year, month, referenceDate),
    budgetUsage: computeBudgetUsage(input.transactions, input.budgets, curStart, curEnd),
    incomeBaseline,
    subscriptionCandidates: detectSubscriptionCandidates(input.transactions, input.recurringTemplates ?? []),
    unusualTransactions: detectUnusualTransactions(input.transactions.filter((t) => t.date >= curStart && t.date < curEnd)),
    possibleDuplicates: detectPossibleDuplicateTransactions(input.transactions),
    goalPlans,
    doubleCountingWarnings: detectDoubleCountingWarnings(input.savingsGoals, input.savingsContributions),
  }
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---- AI-safe redaction ----
// Strips anything that isn't a verified aggregate or category/merchant
// label: no transaction/goal/category ids, no user id, no notes.

function omit<T extends object, K extends keyof T>(source: T, keys: K[]): Omit<T, K> {
  const result = { ...source }
  for (const key of keys) delete result[key]
  return result
}

export interface AISafeFinancialSnapshot {
  generatedAt: string
  currentMonth: Omit<PeriodTotals, 'from' | 'to'>
  previousMonth: Omit<PeriodTotals, 'from' | 'to'>
  monthOverMonthExpenseChange: MonthOverMonthChange
  topExpenseCategories: Array<{ category: string; totalKrw: number; pctOfTotal: number }>
  topPaymentMethods: Array<{ method: string; totalKrw: number; pctOfTotal: number }>
  smallTransactionBuckets: SmallTransactionBucket[]
  frequentDescriptions: Array<{ description: string; totalKrw: number; count: number }>
  dailyPace: DailyPaceResult
  budgetUsage: Array<Omit<BudgetUsageEntry, 'category_id'>>
  incomeBaseline: IncomeBaselineResult
  subscriptionCandidates: Array<Omit<SubscriptionCandidate, 'key' | 'matchedRecurringTemplate'>>
  unusualTransactionCount: number
  unusualTransactionSamples: Array<{ description: string; amountKrw: number; category: string | null; reason: string }>
  possibleDuplicateCount: number
  goalPlans: Array<Omit<GoalPlan, 'goalId' | 'name'> & { goalName: string }>
  doubleCountingWarnings: string[]
}

export function toAISafePayload(snapshot: FinancialSnapshot): AISafeFinancialSnapshot {
  return {
    generatedAt: snapshot.generatedAt,
    currentMonth: {
      totalIncomeKrw: snapshot.currentMonth.totalIncomeKrw,
      totalExpenseKrw: snapshot.currentMonth.totalExpenseKrw,
      netCashFlowKrw: snapshot.currentMonth.netCashFlowKrw,
      savingsRatePct: snapshot.currentMonth.savingsRatePct,
      transactionCount: snapshot.currentMonth.transactionCount,
    },
    previousMonth: {
      totalIncomeKrw: snapshot.previousMonth.totalIncomeKrw,
      totalExpenseKrw: snapshot.previousMonth.totalExpenseKrw,
      netCashFlowKrw: snapshot.previousMonth.netCashFlowKrw,
      savingsRatePct: snapshot.previousMonth.savingsRatePct,
      transactionCount: snapshot.previousMonth.transactionCount,
    },
    monthOverMonthExpenseChange: snapshot.monthOverMonth,
    topExpenseCategories: snapshot.categoryBreakdown
      .slice(0, 8)
      .map((c) => ({ category: c.category_name, totalKrw: c.totalKrw, pctOfTotal: c.pctOfTotal })),
    topPaymentMethods: snapshot.paymentMethodBreakdown
      .slice(0, 5)
      .map((p) => ({ method: p.payment_method_name, totalKrw: p.totalKrw, pctOfTotal: p.pctOfTotal })),
    smallTransactionBuckets: snapshot.smallTransactionBuckets,
    frequentDescriptions: snapshot.topDescriptions.map((d) => ({
      description: d.normalizedDescription,
      totalKrw: d.totalKrw,
      count: d.transactionCount,
    })),
    dailyPace: snapshot.dailyPace,
    budgetUsage: snapshot.budgetUsage.map((usage) => omit(usage, ['category_id'])),
    incomeBaseline: snapshot.incomeBaseline,
    subscriptionCandidates: snapshot.subscriptionCandidates.map((candidate) => omit(candidate, ['key', 'matchedRecurringTemplate'])),
    unusualTransactionCount: snapshot.unusualTransactions.length,
    unusualTransactionSamples: snapshot.unusualTransactions.slice(0, 5).map((u) => ({
      description: u.description,
      amountKrw: u.amountKrw,
      category: u.categoryName,
      reason: u.reason,
    })),
    possibleDuplicateCount: snapshot.possibleDuplicates.length,
    goalPlans: snapshot.goalPlans.map((plan) => ({ ...omit(plan, ['goalId', 'name']), goalName: plan.name })),
    doubleCountingWarnings: snapshot.doubleCountingWarnings.map((w) => w.reason),
  }
}
