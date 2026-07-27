import { test, expect } from '@playwright/test'
import { requiresAuth, signIn, expectNoHorizontalOverflow } from './helpers/auth'
import { mockSubscriptions } from './helpers/mocks'

test.describe('Subscription review', () => {
  test.beforeEach(async ({ page }) => {
    requiresAuth()
    await mockSubscriptions(page)
    await signIn(page)
    await page.goto('/subscriptions')
  })

  test('lists each subscription with the details needed to judge it', async ({ page }) => {
    const card = page.getByRole('article').filter({ hasText: 'Claude AI Pro' })
    await expect(card).toBeVisible()

    await expect(card).toContainText('₩27,000')      // latest amount
    await expect(card).toContainText('Monthly')       // billing frequency
    await expect(card).toContainText('₩324,000')      // estimated yearly cost
    await expect(card).toContainText('High confidence')
    await expect(card).toContainText('Jul 2, 2026')   // last payment
  })

  test('shows the monthly and yearly recurring totals', async ({ page }) => {
    // Scope to the summary card — the yearly figure is also quoted in the
    // overlap hint below it.
    const summary = page.getByRole('region', { name: /recurring cost/i })
    await expect(summary.getByText('₩57,000', { exact: true })).toBeVisible()
    await expect(summary.getByText('₩684,000', { exact: true })).toBeVisible()
  })

  test('highlights overlapping subscriptions in the same family', async ({ page }) => {
    await expect(page.getByText(/ai assistants running together/i)).toBeVisible()
  })

  test('lets the user set a status without cancelling anything automatically', async ({ page }) => {
    const card = page.getByRole('group', { name: /status for claude ai pro/i })

    const reviewButton = card.getByRole('button', { name: 'Review' })
    await expect(reviewButton).toHaveAttribute('aria-pressed', 'true')

    const planToCancel = card.getByRole('button', { name: 'Plan to cancel' })
    await planToCancel.click()
    await expect(planToCancel).toHaveAttribute('aria-pressed', 'true')

    // The app must be explicit that it does not cancel on the user's behalf.
    await expect(page.getByText(/never cancels anything for you/i)).toBeVisible()
  })

  test('fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })
})
