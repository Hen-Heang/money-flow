import { describe, it, expect } from 'vitest'
import { tx } from './fixtures'
import { computeCategoryMonthlySpend, buildBudgetPlan, simulateBudgetChange } from '../budget'
import { getLastCompleteMonths } from '../stats'

const REFERENCE = new Date('2026-07-15T12:00:00')

// Three complete months before July 2026: April, May, June.
const MONTHS = getLastCompleteMonths(REFERENCE, 3)

function foodTransactions(amounts: [number, number, number]) {
  return [
    tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: amounts[0], date: '2026-04-10' }),
    tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: amounts[1], date: '2026-05-10' }),
    tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: amounts[2], date: '2026-06-10' }),
  ]
}

describe('getLastCompleteMonths', () => {
  it('returns complete months only, oldest first, excluding the current month', () => {
    expect(MONTHS).toEqual(['2026-04', '2026-05', '2026-06'])
  })
})

describe('computeCategoryMonthlySpend', () => {
  it('computes per-month totals, average, and median', () => {
    const result = computeCategoryMonthlySpend(foodTransactions([400_000, 420_000, 440_000]), MONTHS)
    expect(result).toHaveLength(1)
    expect(result[0].averageKrw).toBe(420_000)
    expect(result[0].medianKrw).toBe(420_000)
    expect(result[0].monthsOfData).toBe(3)
  })

  it('counts a month with no spending as zero rather than skipping it', () => {
    const transactions = [
      tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 300_000, date: '2026-04-10' }),
      tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 300_000, date: '2026-06-10' }),
    ]
    const result = computeCategoryMonthlySpend(transactions, MONTHS)
    expect(result[0].monthlyTotals.find((m) => m.month === '2026-05')?.totalKrw).toBe(0)
    expect(result[0].averageKrw).toBe(200_000)
  })

  it('ignores transactions outside the analyzed months and the current partial month', () => {
    const transactions = [
      ...foodTransactions([400_000, 420_000, 440_000]),
      tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 999_000, date: '2026-07-05' }),
    ]
    const result = computeCategoryMonthlySpend(transactions, MONTHS)
    expect(result[0].averageKrw).toBe(420_000)
  })
})

describe('buildBudgetPlan — gradual reduction', () => {
  it('proposes an achievable first step for a flexible category, not an aggressive cut', () => {
    const plan = buildBudgetPlan({
      transactions: foodTransactions([400_000, 420_000, 440_000]),
      budgets: [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 420_000 }],
      classifications: { 'cat-food': 'flexible' },
      incomeBaselineKrw: 3_000_000,
      referenceDate: REFERENCE,
    })

    const food = plan.recommendations.find((r) => r.categoryId === 'cat-food')!
    expect(food.reason).toBe('gradual_reduction')
    // 10% trim from the ₩420,000 median, not a jump down to ₩300,000.
    expect(food.recommendedBudgetKrw).toBe(380_000)
    expect(food.recommendedBudgetKrw).toBeGreaterThan(300_000)
    expect(food.rationale).toContain('more achievable')
  })

  it('never trims more than one gradual step even for avoidable categories', () => {
    const plan = buildBudgetPlan({
      transactions: [
        tx({ category_id: 'cat-drink', category_name: 'Drinks', amount_krw: 100_000, date: '2026-04-10' }),
        tx({ category_id: 'cat-drink', category_name: 'Drinks', amount_krw: 100_000, date: '2026-05-10' }),
        tx({ category_id: 'cat-drink', category_name: 'Drinks', amount_krw: 100_000, date: '2026-06-10' }),
      ],
      budgets: [],
      classifications: { 'cat-drink': 'avoidable' },
      incomeBaselineKrw: 3_000_000,
      referenceDate: REFERENCE,
    })

    const drinks = plan.recommendations[0]
    expect(drinks.recommendedBudgetKrw).toBe(80_000)
    expect(drinks.recommendedBudgetKrw).toBeGreaterThanOrEqual(100_000 * 0.8)
  })
})

describe('buildBudgetPlan — protects unclassified and committed categories', () => {
  it('does not trim an unclassified category (family support is never treated as waste by default)', () => {
    const plan = buildBudgetPlan({
      transactions: [
        tx({ category_id: 'cat-family', category_name: 'Family', amount_krw: 500_000, date: '2026-04-05' }),
        tx({ category_id: 'cat-family', category_name: 'Family', amount_krw: 500_000, date: '2026-05-05' }),
        tx({ category_id: 'cat-family', category_name: 'Family', amount_krw: 500_000, date: '2026-06-05' }),
      ],
      budgets: [],
      incomeBaselineKrw: 3_000_000,
      referenceDate: REFERENCE,
    })

    const family = plan.recommendations[0]
    expect(family.spendingClass).toBeNull()
    expect(family.recommendedBudgetKrw).toBe(500_000)
    expect(family.reason).toBe('first_budget')
  })

  it('does not trim a category explicitly classified as a commitment', () => {
    const plan = buildBudgetPlan({
      transactions: [
        tx({ category_id: 'cat-edu', category_name: 'Education', amount_krw: 200_000, date: '2026-04-05' }),
        tx({ category_id: 'cat-edu', category_name: 'Education', amount_krw: 200_000, date: '2026-05-05' }),
        tx({ category_id: 'cat-edu', category_name: 'Education', amount_krw: 200_000, date: '2026-06-05' }),
      ],
      budgets: [{ category_id: 'cat-edu', category_name: 'Education', amount_krw: 200_000 }],
      classifications: { 'cat-edu': 'commitment' },
      incomeBaselineKrw: 3_000_000,
      referenceDate: REFERENCE,
    })

    expect(plan.recommendations[0].recommendedBudgetKrw).toBe(200_000)
    expect(plan.recommendations[0].reason).toBe('hold_steady')
  })
})

describe('buildBudgetPlan — unrealistically low budgets', () => {
  it('raises a budget that sits far below actual committed spending', () => {
    const plan = buildBudgetPlan({
      transactions: [
        tx({ category_id: 'cat-family', category_name: 'Family', amount_krw: 500_000, date: '2026-04-05' }),
        tx({ category_id: 'cat-family', category_name: 'Family', amount_krw: 500_000, date: '2026-05-05' }),
        tx({ category_id: 'cat-family', category_name: 'Family', amount_krw: 500_000, date: '2026-06-05' }),
      ],
      // Budget set at ₩100,000 while ₩500,000 is actually spent every month.
      budgets: [{ category_id: 'cat-family', category_name: 'Family', amount_krw: 100_000 }],
      classifications: { 'cat-family': 'commitment' },
      incomeBaselineKrw: 3_000_000,
      referenceDate: REFERENCE,
    })

    const family = plan.recommendations[0]
    expect(family.reason).toBe('raise_unrealistic')
    expect(family.recommendedBudgetKrw).toBe(500_000)
    expect(family.changeFromCurrentKrw).toBe(400_000)
  })
})

describe('buildBudgetPlan — savings target', () => {
  it('reports the shortfall when the plan does not reach the target savings rate', () => {
    const plan = buildBudgetPlan({
      transactions: foodTransactions([900_000, 900_000, 900_000]),
      budgets: [],
      incomeBaselineKrw: 1_000_000,
      targetSavingsRatePct: 20,
      referenceDate: REFERENCE,
    })

    expect(plan.meetsTarget).toBe(false)
    // Spending ₩900,000 of ₩1,000,000 leaves a 10% rate; 20% needs ₩800,000.
    expect(plan.projectedSavingsRatePct).toBe(10)
    expect(plan.additionalTrimNeededKrw).toBe(100_000)
  })

  it('confirms the target is met when the plan leaves enough room', () => {
    const plan = buildBudgetPlan({
      transactions: foodTransactions([500_000, 500_000, 500_000]),
      budgets: [],
      incomeBaselineKrw: 1_000_000,
      targetSavingsRatePct: 20,
      referenceDate: REFERENCE,
    })

    expect(plan.meetsTarget).toBe(true)
    expect(plan.additionalTrimNeededKrw).toBe(0)
  })

  it('handles zero income without dividing by zero', () => {
    const plan = buildBudgetPlan({
      transactions: foodTransactions([100_000, 100_000, 100_000]),
      budgets: [],
      incomeBaselineKrw: 0,
      referenceDate: REFERENCE,
    })
    expect(plan.projectedSavingsRatePct).toBe(0)
    expect(Number.isFinite(plan.projectedSavingsRatePct)).toBe(true)
  })

  it('returns an empty plan for an account with no transactions', () => {
    const plan = buildBudgetPlan({ transactions: [], budgets: [], incomeBaselineKrw: 0, referenceDate: REFERENCE })
    expect(plan.recommendations).toEqual([])
    expect(plan.totalRecommendedKrw).toBe(0)
  })
})

describe('simulateBudgetChange', () => {
  it('reports monthly and yearly impact for an achievable target', () => {
    const [spend] = computeCategoryMonthlySpend(foodTransactions([400_000, 420_000, 440_000]), MONTHS)
    const result = simulateBudgetChange(spend, 420_000, 350_000)
    expect(result.monthlyDifferenceKrw).toBe(70_000)
    expect(result.yearlyDifferenceKrw).toBe(840_000)
    expect(result.achievable).toBe(true)
  })

  it('flags an over-aggressive cut and suggests a gentler first step', () => {
    const [spend] = computeCategoryMonthlySpend(foodTransactions([400_000, 420_000, 440_000]), MONTHS)
    const result = simulateBudgetChange(spend, 420_000, 200_000)
    expect(result.achievable).toBe(false)
    expect(result.note).toContain('large drop')
  })
})
