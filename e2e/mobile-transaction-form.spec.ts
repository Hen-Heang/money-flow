import { test, expect } from '@playwright/test'
import { requiresAuth, expectNoHorizontalOverflow } from './helpers/auth'

test.describe('Mobile add transaction form', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-428',
      'This suite verifies the iPhone transaction form.'
    )
    requiresAuth()

    await page.goto('/transactions')
    await page.getByRole('button', { name: 'Add transaction' }).click()
    await expect(page.getByRole('heading', { name: 'New Transaction' })).toBeVisible()
  })

  test('shows every transaction field without a collapsed details section', async ({ page }) => {
    await expect(page.getByLabel('Description')).toBeVisible()
    await expect(page.getByText('Category', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Date')).toBeVisible()
    await expect(page.getByText('Payment Method', { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel('Note')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save as Template' })).toBeVisible()

    await expect(page.getByText('MORE DETAILS', { exact: true })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })

  test('keeps the keypad closed until the amount area is tapped', async ({ page }) => {
    const keypadDone = page.getByRole('button', { name: /^Done$/i })

    await expect(keypadDone).toHaveCount(0)
    await page.getByText('Amount', { exact: true }).click()
    await expect(keypadDone).toBeVisible()
  })
})
