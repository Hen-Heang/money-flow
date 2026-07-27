import { test, expect } from '@playwright/test'
import { requiresAuth, expectNoHorizontalOverflow } from './helpers/auth'

const MOCK_REVIEW = {
  month: '2026-06',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  totals: {
    totalIncomeKrw: 3_000_000,
    totalExpenseKrw: 2_100_000,
    netCashFlowKrw: 900_000,
    savingsRatePct: 30,
    transactionCount: 84,
  },
  previousTotals: {
    totalIncomeKrw: 3_000_000,
    totalExpenseKrw: 2_400_000,
    netCashFlowKrw: 600_000,
    savingsRatePct: 20,
    transactionCount: 91,
  },
  categoryComparison: [
    { categoryId: 'cat-food', categoryName: 'Food', currentKrw: 900_000, previousKrw: 1_000_000, deltaKrw: -100_000, deltaPct: -10, direction: 'down' },
    { categoryId: 'cat-drink', categoryName: 'Drinks', currentKrw: 120_000, previousKrw: 60_000, deltaKrw: 60_000, deltaPct: 100, direction: 'up' },
  ],
  bestImprovement: { categoryId: 'cat-food', categoryName: 'Food', currentKrw: 900_000, previousKrw: 1_000_000, deltaKrw: -100_000, deltaPct: -10, direction: 'down' },
  biggestIncrease: { categoryId: 'cat-drink', categoryName: 'Drinks', currentKrw: 120_000, previousKrw: 60_000, deltaKrw: 60_000, deltaPct: 100, direction: 'up' },
  budgetPerformance: [
    { categoryId: 'cat-food', categoryName: 'Food', budgetKrw: 800_000, spentKrw: 900_000, remainingKrw: -100_000, usagePct: 112.5, overBudget: true },
  ],
  subscriptions: { count: 3, monthlyKrw: 77_000, yearlyKrw: 924_000 },
  goalProgress: [
    { name: 'Life', targetUsd: 5000, currentUsd: 500, remainingUsd: 4500, status: 'off_track', requiredMonthlyUsd: 375, plannedMonthlyUsd: 150 },
  ],
  nextMonthPlan: {
    monthsAnalyzed: ['2026-03', '2026-04', '2026-05'],
    projectedSavingsRatePct: 25,
    targetSavingsRatePct: 20,
    meetsTarget: true,
    recommendations: [
      {
        categoryId: '44444444-4444-4444-8444-444444444444',
        categoryName: 'Food',
        currentBudgetKrw: 800_000,
        recommendedBudgetKrw: 850_000,
        averageKrw: 900_000,
        medianKrw: 900_000,
        rationale: 'Food typically costs ₩900,000 a month, but the current budget is ₩800,000. Raising it to ₩850,000 reflects what this commitment actually needs.',
        reason: 'raise_unrealistic',
      },
    ],
  },
}

test.describe('Monthly review', () => {
  test.beforeEach(async ({ page }) => {
    requiresAuth()
    await page.route('**/api/finance/monthly-review**', (route) =>
      route.fulfill({ status: 200, json: MOCK_REVIEW })
    )
    await page.goto('/review')
  })

  test('shows the headline figures for the month', async ({ page }) => {
    await expect(page.getByText('₩3,000,000')).toBeVisible()
    await expect(page.getByText('₩2,100,000')).toBeVisible()
    await expect(page.getByText('30%')).toBeVisible()
  })

  test('reports the best improvement and the category worth a look', async ({ page }) => {
    const improvement = page.getByRole('region', { name: /best improvement/i })
    await expect(improvement).toContainText('Food')

    const watch = page.getByRole('region', { name: /biggest increase/i })
    await expect(watch).toContainText('Drinks')
    // Non-judgemental framing, per the UX requirements.
    await expect(watch).toContainText('Worth a look')
  })

  test('shows budget performance, subscription cost and goal progress', async ({ page }) => {
    await expect(page.getByRole('region', { name: /budget performance/i })).toContainText('Food')
    await expect(page.getByRole('region', { name: /subscription cost/i })).toContainText('₩77,000')
    await expect(page.getByRole('region', { name: /goal progress/i })).toContainText('Life')
  })

  test('requires confirmation before applying next month plan', async ({ page }) => {
    const plan = page.getByRole('region', { name: /plan for next month/i })
    await expect(plan).toContainText('Food')
    await expect(plan).toContainText('reflects what this commitment actually needs')

    await plan.getByRole('button', { name: /accept plan for next month/i }).click()

    await expect(page.getByText(/apply next month's plan\?/i)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText(/apply next month's plan\?/i)).toBeHidden()
  })

  test('lets the user deselect a category before accepting', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: /apply new budget for food/i })
    await expect(checkbox).toBeChecked()

    await checkbox.uncheck()
    await expect(page.getByRole('button', { name: /accept plan for next month/i })).toBeDisabled()
  })

  test('fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })
})
