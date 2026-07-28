import { describe, it, expect } from 'vitest'
import { tx } from './fixtures'
import {
  computePeriodTotals,
  computeCategoryBreakdown,
  computeSmallTransactionBuckets,
  computeBudgetUsage,
  computeDailyPace,
  computeMonthOverMonthChange,
  computeMonthlyIncomeSeries,
  computeIncomeBaseline,
} from '../summary'

describe('computePeriodTotals — savings rate', () => {
  it('computes income, expense, net, and savings rate', () => {
    const transactions = [
      tx({ type: 'income', amount_krw: 1_000_000, date: '2026-07-05' }),
      tx({ type: 'expense', amount_krw: 300_000, date: '2026-07-10' }),
      tx({ type: 'expense', amount_krw: 200_000, date: '2026-07-15' }),
    ]
    const result = computePeriodTotals(transactions, '2026-07-01', '2026-07-31')
    expect(result.totalIncomeKrw).toBe(1_000_000)
    expect(result.totalExpenseKrw).toBe(500_000)
    expect(result.netCashFlowKrw).toBe(500_000)
    expect(result.savingsRatePct).toBe(50)
  })

  it('returns 0% savings rate on zero income instead of NaN/Infinity', () => {
    const transactions = [tx({ type: 'expense', amount_krw: 50_000, date: '2026-07-10' })]
    const result = computePeriodTotals(transactions, '2026-07-01', '2026-07-31')
    expect(result.savingsRatePct).toBe(0)
    expect(Number.isFinite(result.savingsRatePct)).toBe(true)
  })

  it('handles a completely empty transaction history', () => {
    const result = computePeriodTotals([], '2026-07-01', '2026-07-31')
    expect(result).toMatchObject({
      totalIncomeKrw: 0,
      totalExpenseKrw: 0,
      netCashFlowKrw: 0,
      savingsRatePct: 0,
      transactionCount: 0,
    })
  })
})

describe('computeDailyPace — partial month projection', () => {
  it('projects end-of-month spend from a partial current month', () => {
    const today = new Date('2026-07-10T12:00:00')
    const transactions = Array.from({ length: 9 }, (_, i) =>
      tx({ type: 'expense', amount_krw: 10_000, date: `2026-07-0${i + 1}` })
    )
    const result = computeDailyPace(transactions, 2026, 7, today)
    expect(result.isCurrentMonth).toBe(true)
    expect(result.isPartialMonth).toBe(true)
    expect(result.daysPassed).toBe(10)
    expect(result.dailyAvgKrw).toBe(9000) // 90,000 / 10 days
    expect(result.daysRemaining).toBe(21) // July has 31 days
    expect(result.projectedEndOfMonthKrw).toBe(9000 * 31)
  })

  it('does not project for a fully-elapsed past month', () => {
    const today = new Date('2026-08-15T12:00:00')
    const transactions = [tx({ type: 'expense', amount_krw: 100_000, date: '2026-07-15' })]
    const result = computeDailyPace(transactions, 2026, 7, today)
    expect(result.isCurrentMonth).toBe(false)
    expect(result.projectedEndOfMonthKrw).toBe(100_000)
    expect(result.daysRemaining).toBe(0)
  })
})

describe('computeBudgetUsage', () => {
  it('computes usage percentage, remaining, and over-budget flag', () => {
    const transactions = [
      tx({ category_id: 'cat-food', amount_krw: 90_000, date: '2026-07-05' }),
      tx({ category_id: 'cat-food', amount_krw: 20_000, date: '2026-07-06' }),
      tx({ category_id: 'cat-transport', amount_krw: 5_000, date: '2026-07-06' }),
    ]
    const budgets = [
      { category_id: 'cat-food', category_name: 'Food & Dining', amount_krw: 100_000 },
      { category_id: 'cat-transport', category_name: 'Transport', amount_krw: 50_000 },
    ]
    const result = computeBudgetUsage(transactions, budgets, '2026-07-01', '2026-08-01')
    const food = result.find((r) => r.category_id === 'cat-food')!
    expect(food.spentKrw).toBe(110_000)
    expect(food.remainingKrw).toBe(-10_000)
    expect(food.overBudget).toBe(true)
    expect(food.usagePct).toBe(110)

    const transport = result.find((r) => r.category_id === 'cat-transport')!
    expect(transport.overBudget).toBe(false)
    expect(transport.remainingKrw).toBe(45_000)
  })

  it('handles a budgeted category with no spending yet', () => {
    const result = computeBudgetUsage([], [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 100_000 }], '2026-07-01', '2026-08-01')
    expect(result[0].spentKrw).toBe(0)
    expect(result[0].usagePct).toBe(0)
  })
})

describe('computeMonthOverMonthChange', () => {
  it('reports direction and delta', () => {
    expect(computeMonthOverMonthChange(120_000, 100_000)).toMatchObject({ direction: 'up', deltaKrw: 20_000, deltaPct: 20 })
    expect(computeMonthOverMonthChange(80_000, 100_000)).toMatchObject({ direction: 'down', deltaKrw: -20_000, deltaPct: -20 })
    expect(computeMonthOverMonthChange(100_000, 100_000)).toMatchObject({ direction: 'flat', deltaKrw: 0 })
  })

  it('handles no prior-month baseline without dividing by zero', () => {
    const result = computeMonthOverMonthChange(50_000, 0)
    expect(result.deltaPct).toBeNull()
    expect(result.direction).toBe('unknown')
  })
})

describe('computeMonthlyIncomeSeries + computeIncomeBaseline — missing months', () => {
  it('marks the current month incomplete and averages only complete months', () => {
    const referenceDate = new Date('2026-07-15T12:00:00')
    const transactions = [
      tx({ type: 'income', amount_krw: 3_000_000, date: '2026-05-01' }),
      tx({ type: 'income', amount_krw: 3_200_000, date: '2026-06-01' }),
      // July (current, partial) has a much smaller income so far — must not drag the baseline down.
      tx({ type: 'income', amount_krw: 500_000, date: '2026-07-01' }),
      // April had no income at all — a genuinely missing month, simply absent from the series.
    ]
    const series = computeMonthlyIncomeSeries(transactions, referenceDate)
    const july = series.find((m) => m.month === '2026-07')!
    expect(july.isComplete).toBe(false)

    const baseline = computeIncomeBaseline(series)
    expect(baseline.monthsUsed).toBe(2)
    expect(baseline.conservativeBaselineKrw).toBe(3_100_000)
    expect(baseline.basedOnPartialData).toBe(false)
  })

  it('flags the estimate as partial when there is no complete month yet', () => {
    const referenceDate = new Date('2026-07-15T12:00:00')
    const series = computeMonthlyIncomeSeries([tx({ type: 'income', amount_krw: 500_000, date: '2026-07-05' })], referenceDate)
    const baseline = computeIncomeBaseline(series)
    expect(baseline.basedOnPartialData).toBe(true)
    expect(baseline.monthsUsed).toBe(1)
  })

  it('returns zeroed-out baseline on empty history', () => {
    const baseline = computeIncomeBaseline([])
    expect(baseline).toMatchObject({ averageMonthlyIncomeKrw: 0, conservativeBaselineKrw: 0, monthsUsed: 0, basedOnPartialData: true })
  })

  it('sums multiple income payments within the same month', () => {
    const referenceDate = new Date('2026-08-01T12:00:00')
    const series = computeMonthlyIncomeSeries(
      [
        tx({ type: 'income', amount_krw: 2_000_000, date: '2026-07-01' }),
        tx({ type: 'income', amount_krw: 500_000, date: '2026-07-15', description: 'Freelance' }),
      ],
      referenceDate
    )
    expect(series.find((m) => m.month === '2026-07')?.incomeKrw).toBe(2_500_000)
  })
})

describe('multi-currency handling', () => {
  it('always aggregates via the stored KRW-equivalent, regardless of original currency', () => {
    const transactions = [
      tx({ currency: 'KRW', amount_krw: 10_000, amount_usd: 7.3, date: '2026-07-01' }),
      tx({ currency: 'USD', amount_krw: 13_700, amount_usd: 10, date: '2026-07-02' }),
    ]
    const result = computePeriodTotals(transactions, '2026-07-01', '2026-07-31')
    expect(result.totalExpenseKrw).toBe(23_700)
  })
})

describe('computeCategoryBreakdown', () => {
  it('falls back to Uncategorized for missing category', () => {
    const transactions = [tx({ category_id: null, category_name: null, amount_krw: 5000 })]
    const result = computeCategoryBreakdown(transactions)
    expect(result[0].category_name).toBe('Uncategorized')
    expect(result[0].pctOfTotal).toBe(100)
  })
})

describe('computeSmallTransactionBuckets', () => {
  it('buckets expenses into the four defined ranges', () => {
    const transactions = [
      tx({ amount_krw: 3000 }),
      tx({ amount_krw: 8000 }),
      tx({ amount_krw: 25000 }),
      tx({ amount_krw: 50000 }),
    ]
    const buckets = computeSmallTransactionBuckets(transactions)
    expect(buckets[0]).toMatchObject({ count: 1, totalKrw: 3000 })
    expect(buckets[1]).toMatchObject({ count: 1, totalKrw: 8000 })
    expect(buckets[2]).toMatchObject({ count: 1, totalKrw: 25000 })
    expect(buckets[3]).toMatchObject({ count: 1, totalKrw: 50000 })
  })
})
