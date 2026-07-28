import type { Page } from '@playwright/test'

// Deterministic fixtures so the UI assertions don't depend on whatever data
// happens to be in the test account.

export const MOCK_INSIGHTS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    insight_type: 'positive_trend',
    severity: 'positive',
    title: 'Your savings rate improved this month',
    summary: 'You are keeping 42% of your income this month, up from 31% last month.',
    evidence: {
      currentSavingsRatePct: 42,
      previousSavingsRatePct: 31,
      insightKey: 'positive:savings-rate-improved',
      role: 'positive',
      action: { kind: 'none', label: '' },
    },
    estimated_monthly_savings_krw: null,
    confidence: 'high',
    status: 'new',
    snoozed_until: null,
    expires_at: null,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    insight_type: 'category_overspend',
    severity: 'warning',
    title: 'Food spending may exceed its budget by ₩28,000',
    summary: 'Food is at ₩292,000 of ₩350,000 after 20 days. At this pace it reaches about ₩378,000 by month end.',
    evidence: {
      category: 'Food',
      spentKrw: 292000,
      budgetKrw: 350000,
      projectedKrw: 378000,
      overshootKrw: 28000,
      insightKey: 'warning:budget:cat-food',
      role: 'warning',
      action: { kind: 'view_analytics', label: 'Review category', href: '/analytics' },
    },
    estimated_monthly_savings_krw: 28000,
    confidence: 'high',
    status: 'new',
    snoozed_until: null,
    expires_at: null,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    insight_type: 'budget_recommendation',
    severity: 'info',
    title: 'A ₩380,000 target for Food looks achievable',
    summary: 'Food averaged ₩420,000 over the last 3 months. A first target of ₩380,000 is more achievable than immediately reducing it to ₩290,000.',
    evidence: {
      category: 'Food',
      currentBudgetKrw: 350000,
      recommendedBudgetKrw: 380000,
      averageMonthlyKrw: 420000,
      insightKey: 'action:budget:cat-food',
      role: 'action',
      action: {
        kind: 'adjust_budget',
        label: 'Review budget change',
        href: '/budget',
        categoryId: '44444444-4444-4444-8444-444444444444',
        categoryName: 'Food',
        currentValueKrw: 350000,
        proposedValueKrw: 380000,
      },
    },
    estimated_monthly_savings_krw: null,
    confidence: 'high',
    status: 'new',
    snoozed_until: null,
    expires_at: null,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  },
]

export const MOCK_SUBSCRIPTIONS = {
  subscriptions: [
    {
      key: 'cat-sub:claude ai pro',
      name: 'Claude AI Pro',
      variantDescriptions: ['Claude AI Pro', 'Claude AI'],
      latestAmountKrw: 27000,
      averageAmountKrw: 27000,
      frequency: 'monthly',
      lastPaymentDate: '2026-07-02',
      estimatedYearlyCostKrw: 324000,
      confidence: 'high',
      occurrenceCount: 3,
      categoryName: 'Subscriptions',
      averageIntervalDays: 30,
      status: 'review',
      note: null,
    },
    {
      key: 'cat-sub:chatgpt plus',
      name: 'ChatGPT Plus',
      variantDescriptions: ['ChatGPT Plus'],
      latestAmountKrw: 30000,
      averageAmountKrw: 30000,
      frequency: 'monthly',
      lastPaymentDate: '2026-07-10',
      estimatedYearlyCostKrw: 360000,
      confidence: 'high',
      occurrenceCount: 4,
      categoryName: 'Subscriptions',
      averageIntervalDays: 30,
      status: 'keep',
      note: null,
    },
  ],
  summary: { totalCount: 2, activeCount: 2, totalYearlyKrw: 684000, totalMonthlyKrw: 57000 },
}

export const MOCK_GOAL_PLANS = {
  plans: [
    {
      goalId: '55555555-5555-4555-8555-555555555555',
      name: 'Life',
      targetUsd: 5000,
      currentUsd: 500,
      remainingUsd: 4500,
      surplusUsd: 0,
      deadline: '2027-07-01',
      monthsRemaining: 12,
      currentPlannedMonthlyUsd: 150,
      requiredMonthlyUsd: 375,
      effectiveMonthlyRateUsd: 150,
      projectedCompletionDate: '2029-01-01',
      status: 'off_track',
      contributionHistory: [
        { amountUsd: 150, month: '2026-06', source: 'planned', createdAt: '2026-06-02T00:00:00Z' },
        { amountUsd: 350, month: '2026-05', source: 'manual', createdAt: '2026-05-10T00:00:00Z' },
      ],
      contributionCount: 2,
    },
  ],
  doubleCountingWarnings: [
    {
      goalIds: ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'],
      goalNames: ['Emergency Fund', 'Emergency Savings'],
      reason: '"Emergency Fund" and "Emergency Savings" have very similar names — confirm these track separate real-world balances.',
    },
  ],
}

export async function mockInsights(page: Page, insights = MOCK_INSIGHTS) {
  await page.route('**/api/ai/insights**', async (route) => {
    const method = route.request().method()

    if (method === 'PATCH') {
      return route.fulfill({ status: 200, json: { insight: insights[0] } })
    }
    if (method === 'DELETE') {
      return route.fulfill({ status: 200, json: { deleted: true } })
    }
    return route.fulfill({ status: 200, json: { insights, generated: false } })
  })
}

export async function mockSubscriptions(page: Page, payload = MOCK_SUBSCRIPTIONS) {
  await page.route('**/api/finance/subscriptions**', async (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({ status: 200, json: { subscription: payload.subscriptions[0] } })
    }
    return route.fulfill({ status: 200, json: payload })
  })
}

export async function mockGoalPlans(page: Page, payload = MOCK_GOAL_PLANS) {
  await page.route('**/api/finance/goal-plans**', (route) =>
    route.fulfill({ status: 200, json: payload })
  )
}
