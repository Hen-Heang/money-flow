import { describe, it, expect } from 'vitest'
import {
  computeMonthlyReport,
  renderMonthlyReportTelegramMessage,
  resolveTargetReportMonth,
} from '../monthly-report'
import { tx } from '@/lib/finance/analysis/__tests__/fixtures'
import type { EngineSavingsGoal } from '@/lib/finance/analysis'

const REFERENCE = new Date('2026-07-31T12:00:00Z')

// Two months of income + expenses, plus a monthly "Netflix" charge spanning
// three months so subscription clustering has enough occurrences to detect
// a recurring expense.
function baseTransactions() {
  return [
    tx({ type: 'income', category_id: null, category_name: null, amount_krw: 3_000_000, date: '2026-06-05', description: 'Salary' }),
    tx({ type: 'income', category_id: null, category_name: null, amount_krw: 3_000_000, date: '2026-07-05', description: 'Salary' }),

    tx({ category_id: 'cat-food', category_name: 'Food & Dining', amount_krw: 500_000, date: '2026-06-10', description: 'Groceries' }),
    tx({ category_id: 'cat-food', category_name: 'Food & Dining', amount_krw: 400_000, date: '2026-07-10', description: 'Groceries' }),

    tx({ category_id: 'cat-transport', category_name: 'Transport', amount_krw: 40_000, date: '2026-06-12', description: 'Bus' }),
    tx({ category_id: 'cat-transport', category_name: 'Transport', amount_krw: 50_000, date: '2026-07-12', description: 'Bus' }),

    tx({ category_id: 'cat-ent', category_name: 'Entertainment', amount_krw: 15_000, date: '2026-05-01', description: 'Netflix' }),
    tx({ category_id: 'cat-ent', category_name: 'Entertainment', amount_krw: 15_000, date: '2026-06-01', description: 'Netflix' }),
    tx({ category_id: 'cat-ent', category_name: 'Entertainment', amount_krw: 15_000, date: '2026-07-01', description: 'Netflix' }),
  ]
}

describe('computeMonthlyReport — headline numbers', () => {
  it('computes income, expenses, net savings and savings rate for the target month only', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.incomeKrw).toBe(3_000_000)
    expect(report.expenseKrw).toBe(465_000) // 400k + 50k + 15k
    expect(report.netSavingsKrw).toBe(2_535_000)
    expect(report.savingsRatePct).toBe(84.5)
    expect(report.hasActivity).toBe(true)
    expect(report.month).toBe('2026-07')
    expect(report.monthLabel).toBe('July 2026')
  })

  it('reports zero activity and hasActivity=false for a month with no transactions', () => {
    const report = computeMonthlyReport({
      month: '2026-09',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: new Date('2026-09-30T00:00:00Z'),
    })

    expect(report.incomeKrw).toBe(0)
    expect(report.expenseKrw).toBe(0)
    expect(report.hasActivity).toBe(false)
  })
})

describe('computeMonthlyReport — previous-month comparison', () => {
  it('reports deltas against the previous month', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.previousMonth.month).toBe('2026-06')
    expect(report.previousMonth.incomeKrw).toBe(3_000_000)
    expect(report.previousMonth.expenseKrw).toBe(555_000) // 500k + 40k + 15k
    expect(report.previousMonth.expenseDeltaPct).toBe(-16.2)
    expect(report.previousMonth.savingsRateDeltaPct).toBeCloseTo(3.0, 1)
  })

  it('returns null deltas when there is no previous-month baseline', () => {
    const report = computeMonthlyReport({
      month: '2026-01',
      transactions: [tx({ type: 'income', amount_krw: 100_000, date: '2026-01-05' })],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: new Date('2026-01-31T00:00:00Z'),
    })

    expect(report.previousMonth.incomeDeltaPct).toBeNull()
    expect(report.previousMonth.savingsRateDeltaPct).toBeNull()
  })
})

describe('computeMonthlyReport — top categories, budgets, recurring', () => {
  it('reports the top three categories for the month', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.topCategories).toHaveLength(3)
    expect(report.topCategories[0]).toMatchObject({ name: 'Food & Dining', totalKrw: 400_000 })
  })

  it('flags an over-budget category', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [{ category_id: 'cat-food', category_name: 'Food & Dining', amount_krw: 300_000 }],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.budgetStatus).toHaveLength(1)
    expect(report.budgetStatus[0].overBudget).toBe(true)
    expect(report.budgetStatus[0].spentKrw).toBe(400_000)
  })

  it('detects a monthly recurring charge from repeated transactions', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.recurringExpenses.items.some((r) => r.name === 'Netflix')).toBe(true)
    expect(report.recurringExpenses.totalMonthlyKrw).toBeGreaterThan(0)
  })
})

describe('computeMonthlyReport — savings goals', () => {
  const goal: EngineSavingsGoal = {
    id: 'g1',
    name: 'Vacation',
    target_usd: 5000,
    current_usd: 1000,
    deadline: '2026-08-01',
    auto_monthly_usd: 100,
    purpose: null,
  }

  it('surfaces a goal behind schedule', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [goal],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.savingsGoals).toHaveLength(1)
    expect(['off_track', 'at_risk']).toContain(report.savingsGoals[0].status)
  })
})

describe('computeMonthlyReport — insights', () => {
  it('always returns exactly one positive, one warning and one action insight', () => {
    const report = computeMonthlyReport({
      month: '2026-09',
      transactions: [],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: new Date('2026-09-30T00:00:00Z'),
    })

    expect(report.insights.positive.message.length).toBeGreaterThan(0)
    expect(report.insights.warning.message.length).toBeGreaterThan(0)
    expect(report.insights.action.message.length).toBeGreaterThan(0)
  })

  it('names the over-budget category in the warning and action insights', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [{ category_id: 'cat-food', category_name: 'Food & Dining', amount_krw: 300_000 }],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.insights.warning.message).toContain('Food & Dining')
    expect(report.insights.action.message).toContain('Food & Dining')
  })

  it('celebrates a rising savings rate as the positive insight when nothing is over budget', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    expect(report.insights.positive.message).toMatch(/savings rate rose/i)
  })
})

describe('renderMonthlyReportTelegramMessage', () => {
  const identity = (s: string) => s

  it('includes every required section and a link to the full review', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: baseTransactions(),
      budgets: [{ category_id: 'cat-food', category_name: 'Food & Dining', amount_krw: 300_000 }],
      savingsGoals: [
        { id: 'g1', name: 'Vacation', target_usd: 5000, current_usd: 1000, deadline: '2026-08-01', auto_monthly_usd: 100, purpose: null },
      ],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    const message = renderMonthlyReportTelegramMessage(report, identity, 'https://example.com/review?month=2026-07')

    expect(message).toContain('July 2026 report')
    expect(message).toContain('Top categories')
    expect(message).toContain('Budget status')
    expect(message).toContain('Savings goals')
    expect(message).toContain('Recurring')
    expect(message).toContain('https://example.com/review?month=2026-07')
    expect(message).toContain('View the full monthly review')
  })

  it('escapes user-controlled category names through the provided escaper', () => {
    const report = computeMonthlyReport({
      month: '2026-07',
      transactions: [
        tx({ type: 'income', amount_krw: 100_000, date: '2026-07-01' }),
        tx({ category_id: 'a', category_name: '<script>', amount_krw: 10_000, date: '2026-07-05' }),
      ],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTemplates: [],
      referenceDate: REFERENCE,
    })

    const message = renderMonthlyReportTelegramMessage(
      report,
      (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      'https://example.com/review'
    )

    expect(message).toContain('&lt;script&gt;')
    expect(message).not.toContain('<script>')
  })
})

describe('resolveTargetReportMonth', () => {
  it('resolves the previous calendar month in the user timezone', () => {
    // 2026-08-01T00:30:00Z is already Aug 1st in Seoul (UTC+9).
    expect(resolveTargetReportMonth(new Date('2026-08-01T00:30:00Z'), 'Asia/Seoul')).toBe('2026-07')
  })

  it('gives an earlier timezone a different (earlier) target month for the same instant', () => {
    // The same instant is still July 31st in Los Angeles (UTC-7 in August).
    expect(resolveTargetReportMonth(new Date('2026-08-01T00:30:00Z'), 'America/Los_Angeles')).toBe('2026-06')
  })

  it('handles a January rollover to the previous December', () => {
    expect(resolveTargetReportMonth(new Date('2026-01-15T00:00:00Z'), 'UTC')).toBe('2025-12')
  })

  it('falls back to UTC for an invalid timezone instead of throwing', () => {
    expect(() => resolveTargetReportMonth(new Date('2026-08-01T00:30:00Z'), 'Not/AZone')).not.toThrow()
    expect(resolveTargetReportMonth(new Date('2026-08-15T00:00:00Z'), 'Not/AZone')).toBe('2026-07')
  })
})
