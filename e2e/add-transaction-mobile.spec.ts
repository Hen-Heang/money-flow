import { test, expect } from '@playwright/test'
import { requiresAuth, expectNoHorizontalOverflow } from './helpers/auth'

// The mobile Add Transaction sheet used to hide Date, Payment Method, Note,
// and Save as Template behind a "MORE DETAILS" toggle, and auto-opened the
// numeric keypad on load. Both behaviors made the form hard to review on an
// iPhone, so this spec locks in the fix: every field visible up front, and
// the keypad opening only when the user asks for it.

const CATEGORIES = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Food', icon: '🍔', color: '#ef4444', type: 'expense' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Salary', icon: '💰', color: '#10b981', type: 'income' },
]

const PAYMENT_METHODS = [
  { id: '33333333-3333-4333-8333-333333333333', name: 'Cash', icon: '💵' },
]

test.describe('Add Transaction sheet — mobile fields always visible', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-428', 'This form layout only applies to the mobile sheet.')
    requiresAuth()

    await page.route('**/rest/v1/categories**', (route) => route.fulfill({ status: 200, json: CATEGORIES }))
    await page.route('**/rest/v1/payment_methods**', (route) => route.fulfill({ status: 200, json: PAYMENT_METHODS }))
    await page.route('**/rest/v1/transaction_templates**', (route) => route.fulfill({ status: 200, json: [] }))
    await page.route('**/rest/v1/transactions**', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({ status: 200, json: [] })
    })

    await page.goto('/transactions?action=add')
    await expect(page.getByRole('heading', { name: 'New Transaction' })).toBeVisible()
  })

  test('shows every field without pressing More Details', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'EXPENSE' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'INCOME' })).toBeVisible()
    await expect(page.locator('[aria-label="Amount"]')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Category' })).toBeVisible()
    await expect(page.locator('input[name="description"]')).toBeVisible()
    await expect(page.locator('input[name="date"]')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Payment Method' })).toBeVisible()
    await expect(page.locator('textarea[name="note"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /save as template/i })).toBeVisible()
  })

  test('has no More Details / Fewer Details toggle', async ({ page }) => {
    await expect(page.getByText(/more details|fewer details/i)).toHaveCount(0)
  })

  test('keeps the numeric keypad closed when the sheet first opens', async ({ page }) => {
    await expect(page.getByRole('button', { name: '7', exact: true })).toHaveCount(0)
    await expect(page.locator('button[form="tx-form-mobile"]')).toBeVisible()
  })

  test('opens the numeric keypad when the Amount area is tapped', async ({ page }) => {
    await page.locator('[aria-label="Amount"]').click()
    await expect(page.getByRole('button', { name: '7', exact: true })).toBeVisible()
    await expect(page.locator('button[form="tx-form-mobile"]')).toHaveCount(0)
  })

  test('closing the keypad with Done brings back the Save button', async ({ page }) => {
    await page.locator('[aria-label="Amount"]').click()
    await page.getByRole('button', { name: '7', exact: true }).click()
    await page.getByRole('button', { name: /done/i }).click()

    await expect(page.getByRole('button', { name: '7', exact: true })).toHaveCount(0)
    await expect(page.locator('button[form="tx-form-mobile"]')).toBeVisible()
  })

  test('fits the iPhone viewport without horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })
})
