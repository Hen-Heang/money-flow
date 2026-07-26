// Adaptive budget recommendations (Feature 5).
//
// Deliberately conservative by design:
//  - Recommends ONE achievable step, never an aggressive target. A category
//    averaging ₩420,000 gets a ₩380,000 first target, not ₩300,000.
//  - Only trims categories the user has explicitly classified as `flexible`
//    or `avoidable`. Unclassified categories are never auto-trimmed, so
//    family support / education can't be treated as waste by default.
//  - Raises budgets that are unrealistically below actual committed spend.

import { money, sumMoney, roundKRW, pct, safeDiv } from './money'
import { median, getLastCompleteMonths, roundToStep, budgetRoundingStep } from './stats'
import type { EngineTransaction, EngineBudget } from './types'

export type SpendingClass = 'essential' | 'commitment' | 'growth' | 'flexible' | 'avoidable'

// Only explicitly-classified discretionary categories get trimmed, and only
// by a modest amount. Everything else defaults to a 0% step.
const REDUCTION_BY_CLASS: Record<SpendingClass, number> = {
  essential: 0,
  commitment: 0,
  growth: 0,
  flexible: 0.1,
  avoidable: 0.2,
}

// Hard ceiling on how much a single recommendation may cut, so the plan
// always stays in "achievable next step" territory.
const MAX_SINGLE_STEP_REDUCTION_PCT = 0.2

// A budget this far below real spending is treated as unrealistic and gets
// raised toward the actual figure rather than left as a guaranteed overspend.
const UNREALISTIC_BUDGET_RATIO = 1.25

export interface CategoryMonthlySpend {
  categoryId: string
  categoryName: string
  monthlyTotals: Array<{ month: string; totalKrw: number }>
  averageKrw: number
  medianKrw: number
  monthsOfData: number
}

export interface BudgetRecommendation {
  categoryId: string
  categoryName: string
  spendingClass: SpendingClass | null
  currentBudgetKrw: number
  averageKrw: number
  medianKrw: number
  monthsOfData: number
  recommendedBudgetKrw: number
  changeFromCurrentKrw: number
  changeFromTypicalKrw: number
  rationale: string
  reason: 'raise_unrealistic' | 'gradual_reduction' | 'hold_steady' | 'first_budget'
}

export interface BudgetPlanResult {
  monthsAnalyzed: string[]
  recommendations: BudgetRecommendation[]
  totalRecommendedKrw: number
  totalCurrentBudgetKrw: number
  incomeBaselineKrw: number
  projectedSavingsRatePct: number
  targetSavingsRatePct: number
  meetsTarget: boolean
  additionalTrimNeededKrw: number
}

// Buckets a category's spend per complete month. Months with no spend count
// as ₩0 — for a *monthly* budget an inactive month is real signal, not a
// gap to be excluded.
export function computeCategoryMonthlySpend(
  transactions: EngineTransaction[],
  months: string[]
): CategoryMonthlySpend[] {
  const monthSet = new Set(months)
  const byCategory = new Map<string, { name: string; perMonth: Map<string, number> }>()

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (!t.category_id) continue
    const monthKey = t.date.slice(0, 7)
    if (!monthSet.has(monthKey)) continue

    const entry = byCategory.get(t.category_id) ?? { name: t.category_name ?? 'Uncategorized', perMonth: new Map() }
    entry.perMonth.set(monthKey, (entry.perMonth.get(monthKey) ?? 0) + t.amount_krw)
    byCategory.set(t.category_id, entry)
  }

  return Array.from(byCategory.entries())
    .map(([categoryId, entry]) => {
      const monthlyTotals = months.map((month) => ({ month, totalKrw: roundKRW(entry.perMonth.get(month) ?? 0) }))
      const values = monthlyTotals.map((m) => m.totalKrw)
      return {
        categoryId,
        categoryName: entry.name,
        monthlyTotals,
        averageKrw: roundKRW(safeDiv(sumMoney(values), values.length)),
        medianKrw: roundKRW(median(values)),
        monthsOfData: months.length,
      }
    })
    .sort((a, b) => b.averageKrw - a.averageKrw)
}

function formatKrw(value: number): string {
  return `₩${Math.round(value).toLocaleString('en-US')}`
}

function buildRecommendation(
  spend: CategoryMonthlySpend,
  currentBudgetKrw: number,
  spendingClass: SpendingClass | null
): BudgetRecommendation {
  // Median resists a single unusual month better than the mean, so it's the
  // baseline for "what this category typically costs".
  const typical = spend.monthsOfData >= 3 ? spend.medianKrw : spend.averageKrw
  const step = budgetRoundingStep(typical)

  let recommended: number
  let reason: BudgetRecommendation['reason']
  let rationale: string

  const hasBudget = currentBudgetKrw > 0

  if (hasBudget && typical > currentBudgetKrw * UNREALISTIC_BUDGET_RATIO) {
    // The existing budget is so far below reality that keeping it just
    // guarantees a monthly "over budget" alert. Raise it to the real figure.
    recommended = roundToStep(typical, step)
    reason = 'raise_unrealistic'
    rationale =
      `${spend.categoryName} typically costs ${formatKrw(typical)} a month, but the current budget is ${formatKrw(currentBudgetKrw)}. ` +
      `Raising it to ${formatKrw(recommended)} reflects what this commitment actually needs.`
  } else {
    const reductionPct = Math.min(spendingClass ? REDUCTION_BY_CLASS[spendingClass] : 0, MAX_SINGLE_STEP_REDUCTION_PCT)

    if (reductionPct > 0) {
      recommended = roundToStep(typical * (1 - reductionPct), step)
      reason = 'gradual_reduction'
      const aggressive = roundToStep(typical * 0.7, step)
      rationale =
        `${spend.categoryName} averaged ${formatKrw(spend.averageKrw)} over the last ${spend.monthsOfData} months. ` +
        `A first target of ${formatKrw(recommended)} is more achievable than immediately reducing it to ${formatKrw(aggressive)}.`
    } else {
      recommended = roundToStep(typical, step)
      reason = hasBudget ? 'hold_steady' : 'first_budget'
      rationale = hasBudget
        ? `${spend.categoryName} has been steady around ${formatKrw(typical)} a month. Keeping the plan close to that keeps it realistic.`
        : `${spend.categoryName} has no budget yet and typically costs ${formatKrw(typical)} a month. That makes a reasonable starting limit.`
    }
  }

  return {
    categoryId: spend.categoryId,
    categoryName: spend.categoryName,
    spendingClass,
    currentBudgetKrw,
    averageKrw: spend.averageKrw,
    medianKrw: spend.medianKrw,
    monthsOfData: spend.monthsOfData,
    recommendedBudgetKrw: recommended,
    changeFromCurrentKrw: recommended - currentBudgetKrw,
    changeFromTypicalKrw: recommended - typical,
    rationale,
    reason,
  }
}

export interface BuildBudgetPlanInput {
  transactions: EngineTransaction[]
  budgets: EngineBudget[]
  classifications?: Record<string, SpendingClass>
  incomeBaselineKrw: number
  targetSavingsRatePct?: number
  lookbackMonths?: number
  referenceDate?: Date
}

export function buildBudgetPlan(input: BuildBudgetPlanInput): BudgetPlanResult {
  const referenceDate = input.referenceDate ?? new Date()
  const lookbackMonths = input.lookbackMonths ?? 3
  const targetSavingsRatePct = input.targetSavingsRatePct ?? 20
  const months = getLastCompleteMonths(referenceDate, lookbackMonths)

  const budgetByCategory = new Map(input.budgets.map((b) => [b.category_id, b.amount_krw]))
  const spendByCategory = computeCategoryMonthlySpend(input.transactions, months)

  const recommendations = spendByCategory
    .filter((s) => s.averageKrw > 0)
    .map((s) => buildRecommendation(s, budgetByCategory.get(s.categoryId) ?? 0, input.classifications?.[s.categoryId] ?? null))

  const totalRecommended = roundKRW(sumMoney(recommendations.map((r) => r.recommendedBudgetKrw)))
  const totalCurrentBudget = roundKRW(sumMoney(input.budgets.map((b) => b.amount_krw)))
  const income = money(input.incomeBaselineKrw)

  const projectedSavingsRatePct = income.isZero() ? 0 : pct(income.minus(totalRecommended), income)
  const meetsTarget = projectedSavingsRatePct >= targetSavingsRatePct

  // How much more would need to come out of the plan to hit the savings
  // target. Surfaced as information — never auto-applied to categories.
  const targetSpend = income.times(1 - targetSavingsRatePct / 100)
  const additionalTrimNeeded = income.isZero() ? 0 : Math.max(roundKRW(money(totalRecommended).minus(targetSpend)), 0)

  return {
    monthsAnalyzed: months,
    recommendations,
    totalRecommendedKrw: totalRecommended,
    totalCurrentBudgetKrw: totalCurrentBudget,
    incomeBaselineKrw: roundKRW(income),
    projectedSavingsRatePct,
    targetSavingsRatePct,
    meetsTarget,
    additionalTrimNeededKrw: additionalTrimNeeded,
  }
}

// "What if I set Food to ₩350,000?" — pure simulation, changes nothing.
export interface BudgetSimulationResult {
  categoryName: string
  currentBudgetKrw: number
  proposedBudgetKrw: number
  typicalMonthlySpendKrw: number
  monthlyDifferenceKrw: number
  yearlyDifferenceKrw: number
  achievable: boolean
  note: string
}

export function simulateBudgetChange(
  spend: CategoryMonthlySpend,
  currentBudgetKrw: number,
  proposedBudgetKrw: number
): BudgetSimulationResult {
  const typical = spend.monthsOfData >= 3 ? spend.medianKrw : spend.averageKrw
  const monthlyDifference = typical - proposedBudgetKrw
  // Asking for more than a 25% cut from the established norm in one step is
  // where budgets usually stop being followed.
  const achievable = proposedBudgetKrw >= typical * 0.75

  return {
    categoryName: spend.categoryName,
    currentBudgetKrw,
    proposedBudgetKrw,
    typicalMonthlySpendKrw: typical,
    monthlyDifferenceKrw: roundKRW(monthlyDifference),
    yearlyDifferenceKrw: roundKRW(monthlyDifference * 12),
    achievable,
    note: achievable
      ? `Setting ${spend.categoryName} to ${formatKrw(proposedBudgetKrw)} would save about ${formatKrw(Math.max(monthlyDifference, 0))} a month versus the typical ${formatKrw(typical)}.`
      : `${formatKrw(proposedBudgetKrw)} is a large drop from the typical ${formatKrw(typical)}. A first step around ${formatKrw(roundToStep(typical * 0.9, budgetRoundingStep(typical)))} is more likely to hold.`,
  }
}
