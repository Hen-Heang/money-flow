import { describe, it, expect } from 'vitest'
import { generateInsightCandidates, selectTopInsights } from '../rules'
import { buildFinancialSnapshot, buildBudgetPlan } from '@/lib/finance/analysis'
import { tx } from '@/lib/finance/analysis/__tests__/fixtures'
import { DEFAULT_PREFERENCES } from '@/lib/finance/server/data'
import type { EngineTransaction, EngineBudget, EngineSavingsGoal } from '@/lib/finance/analysis'

const REFERENCE = new Date('2026-07-20T12:00:00')

function makeSnapshot(opts: {
  transactions?: EngineTransaction[]
  budgets?: EngineBudget[]
  savingsGoals?: EngineSavingsGoal[]
} = {}) {
  return buildFinancialSnapshot({
    transactions: opts.transactions ?? [],
    budgets: opts.budgets ?? [],
    savingsGoals: opts.savingsGoals ?? [],
    savingsContributions: [],
    referenceDate: REFERENCE,
  })
}

function generate(opts: Parameters<typeof makeSnapshot>[0] = {}, prefs = DEFAULT_PREFERENCES) {
  const snapshot = makeSnapshot(opts)
  const budgetPlan = buildBudgetPlan({
    transactions: opts.transactions ?? [],
    budgets: opts.budgets ?? [],
    incomeBaselineKrw: snapshot.incomeBaseline.conservativeBaselineKrw,
    referenceDate: REFERENCE,
  })
  return generateInsightCandidates({ snapshot, budgetPlan, preferences: prefs, referenceDate: REFERENCE })
}

describe('generateInsightCandidates — empty state', () => {
  it('produces no insights for an account with no data', () => {
    expect(generate()).toEqual([])
  })
})

describe('generateInsightCandidates — category overspend warning', () => {
  it('warns before the overspend happens, using the current pace', () => {
    // 20 days in, ₩292,000 spent against a ₩350,000 plan -> paces to ~₩452,600.
    const transactions = Array.from({ length: 20 }, (_, i) =>
      tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 14_600, date: `2026-07-${String(i + 1).padStart(2, '0')}` })
    )
    const candidates = generate({
      transactions,
      budgets: [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 350_000 }],
    })

    const warning = candidates.find((c) => c.key === 'warning:budget:cat-food')
    expect(warning).toBeDefined()
    expect(warning!.role).toBe('warning')
    expect(warning!.severity).toBe('warning')
    expect(warning!.evidence.projectedKrw).toBeGreaterThan(350_000)
    expect(warning!.estimated_monthly_savings_krw).toBeGreaterThan(0)
  })

  it('escalates to critical once the budget is already passed', () => {
    const transactions = [
      tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 400_000, date: '2026-07-05' }),
    ]
    const candidates = generate({
      transactions,
      budgets: [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 350_000 }],
    })

    const warning = candidates.find((c) => c.key === 'warning:budget:cat-food')!
    expect(warning.severity).toBe('critical')
    expect(warning.evidence.overshootKrw).toBe(50_000)
  })

  it('stays quiet when spending is comfortably inside the plan', () => {
    const transactions = [tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 50_000, date: '2026-07-05' })]
    const candidates = generate({
      transactions,
      budgets: [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 350_000 }],
    })
    expect(candidates.find((c) => c.key === 'warning:budget:cat-food')).toBeUndefined()
  })
})

describe('generateInsightCandidates — positive insights', () => {
  it('recognises an improved savings rate month over month', () => {
    const transactions = [
      // June: earned 1,000,000, spent 800,000 -> 20%
      tx({ type: 'income', amount_krw: 1_000_000, date: '2026-06-01' }),
      tx({ type: 'expense', amount_krw: 800_000, date: '2026-06-10' }),
      // July: earned 1,000,000, spent 500,000 -> 50%
      tx({ type: 'income', amount_krw: 1_000_000, date: '2026-07-01' }),
      tx({ type: 'expense', amount_krw: 500_000, date: '2026-07-10' }),
    ]
    const candidates = generate({ transactions })
    const positive = candidates.find((c) => c.key === 'positive:savings-rate-improved')
    expect(positive).toBeDefined()
    expect(positive!.role).toBe('positive')
    expect(positive!.evidence.currentSavingsRatePct).toBe(50)
    expect(positive!.evidence.previousSavingsRatePct).toBe(20)
  })

  it('celebrates a goal that has reached its target', () => {
    const candidates = generate({
      savingsGoals: [
        { id: 'g1', name: 'Emergency Fund', target_usd: 1000, current_usd: 1200, deadline: null, auto_monthly_usd: 0, purpose: null },
      ],
    })
    const positive = candidates.find((c) => c.key === 'positive:goal-achieved:g1')
    expect(positive).toBeDefined()
    expect(positive!.evidence.surplusUsd).toBe(200)
  })
})

describe('generateInsightCandidates — savings goal action', () => {
  it('reports the required monthly contribution when the plan falls short', () => {
    const candidates = generate({
      savingsGoals: [
        { id: 'g1', name: 'Life', target_usd: 5000, current_usd: 500, deadline: '2027-01-01', auto_monthly_usd: 150, purpose: null },
      ],
    })
    const action = candidates.find((c) => c.key === 'action:goal-plan:g1')
    expect(action).toBeDefined()
    expect(action!.role).toBe('action')
    expect(action!.action.kind).toBe('review_goal_plan')
    expect(Number(action!.evidence.requiredMonthlyUsd)).toBeGreaterThan(150)
    expect(action!.action.proposedMonthlyUsd).toBe(action!.evidence.requiredMonthlyUsd)
  })
})

describe('generateInsightCandidates — small purchases', () => {
  it('surfaces frequent small purchases that add up', () => {
    const transactions = Array.from({ length: 15 }, (_, i) =>
      tx({ amount_krw: 5_000, date: `2026-07-${String(i + 1).padStart(2, '0')}`, description: 'Coffee' })
    )
    const candidates = generate({ transactions })
    const action = candidates.find((c) => c.key === 'action:small-purchases')
    expect(action).toBeDefined()
    expect(action!.evidence.smallPurchaseCount).toBe(15)
    expect(action!.evidence.smallPurchaseTotalKrw).toBe(75_000)
  })

  it('ignores a handful of small purchases that do not add up', () => {
    const transactions = [tx({ amount_krw: 3_000, date: '2026-07-01' }), tx({ amount_krw: 2_000, date: '2026-07-02' })]
    expect(generate({ transactions }).find((c) => c.key === 'action:small-purchases')).toBeUndefined()
  })
})

describe('generateInsightCandidates — subscriptions', () => {
  it('flags recurring payments that exceed the budget for their category', () => {
    const transactions = [
      tx({ description: 'Claude AI Pro', amount_krw: 30_000, date: '2026-05-02', category_id: 'cat-sub', category_name: 'Subscriptions' }),
      tx({ description: 'Claude AI Pro', amount_krw: 30_000, date: '2026-06-02', category_id: 'cat-sub', category_name: 'Subscriptions' }),
      tx({ description: 'Claude AI Pro', amount_krw: 30_000, date: '2026-07-02', category_id: 'cat-sub', category_name: 'Subscriptions' }),
      tx({ description: 'ChatGPT Plus', amount_krw: 20_000, date: '2026-05-10', category_id: 'cat-sub', category_name: 'Subscriptions' }),
      tx({ description: 'ChatGPT Plus', amount_krw: 20_000, date: '2026-06-10', category_id: 'cat-sub', category_name: 'Subscriptions' }),
      tx({ description: 'ChatGPT Plus', amount_krw: 20_000, date: '2026-07-10', category_id: 'cat-sub', category_name: 'Subscriptions' }),
    ]
    const candidates = generate({
      transactions,
      budgets: [{ category_id: 'cat-sub', category_name: 'Subscriptions', amount_krw: 30_000 }],
    })

    const action = candidates.find((c) => c.key === 'action:subscriptions')
    expect(action).toBeDefined()
    expect(action!.evidence.monthlyEquivalentKrw).toBe(50_000)
    // ₩50,000 against a ₩30,000 plan is ~67% over.
    expect(action!.evidence.overBudgetPct).toBe(67)
    expect(action!.action.kind).toBe('review_subscriptions')
  })
})

describe('generateInsightCandidates — user spending limit', () => {
  it('warns when projected spending passes a configured monthly limit', () => {
    const transactions = [tx({ amount_krw: 900_000, date: '2026-07-05' })]
    const candidates = generate({ transactions }, { ...DEFAULT_PREFERENCES, monthly_spending_limit_krw: 1_000_000 })
    const warning = candidates.find((c) => c.key === 'warning:spending-limit')
    expect(warning).toBeDefined()
    expect(Number(warning!.evidence.overLimitKrw)).toBeGreaterThan(0)
  })

  it('does not warn when no limit is configured', () => {
    const transactions = [tx({ amount_krw: 900_000, date: '2026-07-05' })]
    expect(generate({ transactions }).find((c) => c.key === 'warning:spending-limit')).toBeUndefined()
  })
})

describe('selectTopInsights', () => {
  it('returns at most three insights, one per role, ordered positive → warning → action', () => {
    const transactions = [
      tx({ type: 'income', amount_krw: 1_000_000, date: '2026-06-01' }),
      tx({ type: 'expense', amount_krw: 800_000, date: '2026-06-10' }),
      tx({ type: 'income', amount_krw: 1_000_000, date: '2026-07-01' }),
      ...Array.from({ length: 15 }, (_, i) =>
        tx({ amount_krw: 5_000, date: `2026-07-${String(i + 1).padStart(2, '0')}`, category_id: 'cat-food', category_name: 'Food' })
      ),
    ]
    const candidates = generate({
      transactions,
      budgets: [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 50_000 }],
    })
    const selected = selectTopInsights(candidates)

    expect(selected.length).toBeLessThanOrEqual(3)
    expect(new Set(selected.map((s) => s.role)).size).toBe(selected.length)
    expect(selected.map((s) => s.role)).toEqual([...selected.map((s) => s.role)].sort((a, b) => {
      const order = { positive: 0, warning: 1, action: 2 } as const
      return order[a] - order[b]
    }))
  })

  it('returns fewer than three when only some roles have candidates', () => {
    const selected = selectTopInsights(
      generate({
        savingsGoals: [
          { id: 'g1', name: 'Emergency Fund', target_usd: 1000, current_usd: 1200, deadline: null, auto_monthly_usd: 0, purpose: null },
        ],
      })
    )
    expect(selected.length).toBeGreaterThan(0)
    expect(selected.length).toBeLessThanOrEqual(3)
  })

  it('picks the highest-priority candidate within each role', () => {
    const candidates = generate({
      transactions: [tx({ category_id: 'cat-food', category_name: 'Food', amount_krw: 400_000, date: '2026-07-05' })],
      budgets: [{ category_id: 'cat-food', category_name: 'Food', amount_krw: 350_000 }],
    })
    const selected = selectTopInsights(candidates)
    const warning = selected.find((s) => s.role === 'warning')!
    const allWarnings = candidates.filter((c) => c.role === 'warning')
    expect(warning.priority).toBe(Math.max(...allWarnings.map((w) => w.priority)))
  })
})
