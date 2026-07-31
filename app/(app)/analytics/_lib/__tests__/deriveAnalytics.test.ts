import { describe, it, expect } from 'vitest'
import { deriveAnalytics, delta } from '../deriveAnalytics'
import type { Transaction } from '@/lib/types'
import type { AnalyticsBudget } from '../../_types'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-15',
    type: 'expense',
    description: 'test',
    amount_krw: 1000,
    amount_usd: 1,
    category_id: null,
    payment_method_id: null,
    note: null,
    ...overrides,
  }
}

describe('delta', () => {
  it('returns null when the previous value is zero', () => {
    expect(delta(100, 0)).toBeNull()
  })

  it('computes percentage change', () => {
    expect(delta(150, 100)).toBe(50)
    expect(delta(50, 100)).toBe(-50)
  })
})

describe('deriveAnalytics', () => {
  const now = new Date('2026-07-15T00:00:00Z')

  it('splits income/expense into the current month bucket', () => {
    const transactions = [
      tx({ date: '2026-07-01', type: 'income', amount_krw: 5000 }),
      tx({ date: '2026-07-10', type: 'expense', amount_krw: 2000 }),
    ]
    const result = deriveAnalytics(transactions, [], 1, now)
    expect(result.totalIncome).toBe(5000)
    expect(result.totalExpense).toBe(2000)
    expect(result.monthlyData).toHaveLength(1)
    expect(result.monthlyData[0]).toMatchObject({ income: 5000, expense: 2000 })
  })

  it('aggregates expense by category, sorted descending', () => {
    const transactions = [
      tx({ type: 'expense', amount_krw: 1000, categories: { name: 'Food', icon: '🍔', color: '#fff' } }),
      tx({ type: 'expense', amount_krw: 3000, categories: { name: 'Rent', icon: '🏠', color: '#000' } }),
      tx({ type: 'expense', amount_krw: 500, categories: { name: 'Food', icon: '🍔', color: '#fff' } }),
    ]
    const result = deriveAnalytics(transactions, [], 1, now)
    expect(result.categoryData[0]).toMatchObject({ name: 'Rent', total: 3000 })
    expect(result.categoryData[1]).toMatchObject({ name: 'Food', total: 1500 })
  })

  it('flags a budget as over when spend exceeds it this month', () => {
    const transactions = [
      tx({ date: '2026-07-05', type: 'expense', amount_krw: 6000, category_id: 'cat-1' }),
    ]
    const budgets: AnalyticsBudget[] = [
      { category_id: 'cat-1', amount_krw: 5000, categories: { name: 'Food', icon: '🍔', color: '#fff' } },
    ]
    const result = deriveAnalytics(transactions, budgets, 1, now)
    expect(result.budgetComparison[0]).toMatchObject({ spent: 6000, budget: 5000, over: true })
    expect(result.overBudgetCount).toBe(1)
  })

  it('computes a same-day forecast with no history as zero daily rate', () => {
    const result = deriveAnalytics([], [], 1, now)
    expect(result.forecast.dayOfMonth).toBe(15)
    expect(result.forecast.thisMonthSpend).toBe(0)
    expect(result.forecast.dailyRate).toBe(0)
    expect(result.forecast.projectedVsBudget).toBeNull()
  })

  it('projects month-end spend from the daily rate so far', () => {
    const transactions = [
      tx({ date: '2026-07-01', type: 'expense', amount_krw: 3000 }),
      tx({ date: '2026-07-10', type: 'expense', amount_krw: 3000 }),
    ]
    // now = July 15 -> daysInMonth 31, dailyRate = 6000/15 = 400
    const result = deriveAnalytics(transactions, [], 1, now)
    expect(result.forecast.dailyRate).toBe(400)
    expect(result.forecast.projectedSpend).toBeCloseTo(400 * 31, 5)
  })
})
