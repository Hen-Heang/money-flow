import { test, expect } from '@playwright/test'
import { requiresAuth, expectNoHorizontalOverflow } from './helpers/auth'
import { mockInsights } from './helpers/mocks'

test.describe('AI Money Coach dashboard', () => {
  test.beforeEach(async ({ page }) => {
    requiresAuth()
    await mockInsights(page)
    await page.goto('/dashboard')
  })

  test('shows at most three insight cards with evidence, period and confidence', async ({ page }) => {
    const coach = page.getByRole('region', { name: /ai money coach/i })
    await expect(coach).toBeVisible()

    const cards = coach.getByRole('article')
    await expect(cards).toHaveCount(3)

    // The warning card carries the engine-computed figures.
    const warning = cards.filter({ hasText: 'Food spending may exceed its budget' })
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('₩292,000')
    await expect(warning).toContainText('July 2026')
    await expect(warning).toContainText('High confidence')
    await expect(warning).toContainText('/mo')
  })

  test('Review expands the evidence panel', async ({ page }) => {
    const warning = page.getByRole('article').filter({ hasText: 'Food spending may exceed its budget' })
    // Exact match — this card also has a "Review category" action button.
    const reviewButton = warning.getByRole('button', { name: 'Review', exact: true })

    await expect(reviewButton).toHaveAttribute('aria-expanded', 'false')
    await reviewButton.click()
    await expect(reviewButton).toHaveAttribute('aria-expanded', 'true')

    await expect(warning.getByText('Spent so far')).toBeVisible()
    await expect(warning.getByText('Budget', { exact: true })).toBeVisible()
    await expect(warning.getByText('Projected', { exact: true })).toBeVisible()
  })

  test('a budget change requires explicit confirmation and shows old vs new value', async ({ page }) => {
    const actionCard = page.getByRole('article').filter({ hasText: 'A ₩380,000 target for Food' })
    await actionCard.getByRole('button', { name: /review budget change/i }).click()

    // Scope to the dialog — these amounts also appear in the card behind it.
    const dialog = page.getByRole('dialog', { name: 'Confirm budget change' })
    await expect(dialog).toBeVisible()

    // Old value, proposed value and the monthly impact must all be shown
    // before anything is applied.
    await expect(dialog.getByText('₩350,000', { exact: true })).toBeVisible()
    await expect(dialog.getByText('₩380,000', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/monthly impact/i)).toBeVisible()

    // Cancelling leaves the card in place — nothing was changed.
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(actionCard).toBeVisible()
  })

  test('dismissing an insight removes it from the list', async ({ page }) => {
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(3)

    await page.getByRole('button', { name: /^Dismiss:/ }).first().click()
    await expect(cards).toHaveCount(2)
  })

  test('shows the guidance disclaimer', async ({ page }) => {
    await expect(
      page.getByText(/budgeting guidance, not professional investment, tax or legal advice/i)
    ).toBeVisible()
  })

  test('fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })
})
