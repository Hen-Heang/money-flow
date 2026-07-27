import { test, expect } from '@playwright/test'
import { requiresAuth, signIn, expectNoHorizontalOverflow } from './helpers/auth'
import { mockGoalPlans } from './helpers/mocks'

test.describe('Savings goal coach', () => {
  test.beforeEach(async ({ page }) => {
    requiresAuth()
    await mockGoalPlans(page)
    await signIn(page)
    await page.goto('/savings')
  })

  test('shows planned vs required monthly contribution and projected completion', async ({ page }) => {
    const coach = page.getByRole('region', { name: /goal coach/i })
    await expect(coach).toBeVisible()

    const card = coach.getByRole('article').filter({ hasText: 'Life' })
    await expect(card).toContainText('$150')   // planned monthly
    await expect(card).toContainText('$375')   // required monthly
    await expect(card).toContainText('12')     // months remaining
    await expect(card).toContainText('Needs attention')
  })

  test('warns about possible double counting between similar goals', async ({ page }) => {
    await expect(page.getByText(/possible double counting/i)).toBeVisible()
    await expect(page.getByText(/confirm these track separate real-world balances/i)).toBeVisible()
  })

  test('shows contribution history on demand', async ({ page }) => {
    const card = page.getByRole('article').filter({ hasText: 'Life' })
    const historyButton = card.getByRole('button', { name: 'History' })

    await expect(historyButton).toHaveAttribute('aria-expanded', 'false')
    await historyButton.click()
    await expect(historyButton).toHaveAttribute('aria-expanded', 'true')

    await expect(card.getByText(/contribution history/i)).toBeVisible()
    await expect(card.getByText('Jun 2026')).toBeVisible()
    await expect(card.getByText('May 2026')).toBeVisible()
  })

  test('creating a contribution plan requires confirmation and never moves the balance', async ({ page }) => {
    const card = page.getByRole('article').filter({ hasText: 'Life' })
    await card.getByRole('button', { name: /create contribution plan/i }).click()

    // Scope to the dialog — $150 also appears on the coach card behind it.
    const dialog = page.getByRole('dialog', { name: 'Confirm contribution plan' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/your saved balance does not change/i)).toBeVisible()
    await expect(dialog.getByText('$150', { exact: true })).toBeVisible()
    await expect(dialog.getByText('$375', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
  })

  test('fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })
})
