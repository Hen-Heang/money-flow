import { test, expect } from '@playwright/test'
import { requiresAuth, signIn, expectNoHorizontalOverflow } from './helpers/auth'

const CATEGORIES = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Food', icon: '🍔', color: '#ef4444', type: 'expense', spending_class: null },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Family', icon: '👨‍👩‍👧', color: '#8b5cf6', type: 'expense', spending_class: 'commitment' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Drinks', icon: '🥤', color: '#f59e0b', type: 'expense', spending_class: null },
]

test.describe('Category classification', () => {
  test.beforeEach(async ({ page }) => {
    requiresAuth()

    await page.route('**/rest/v1/categories**', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        return route.fulfill({ status: 200, json: [CATEGORIES[0]] })
      }
      return route.fulfill({ status: 200, json: CATEGORIES })
    })

    await signIn(page)
    await page.goto('/budget')
  })

  test('shows how many categories are classified', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /category types/i })
    await expect(trigger).toBeVisible()
    await expect(trigger).toContainText('1 of 3 classified')
  })

  test('prompts to classify when nothing is set yet', async ({ page }) => {
    await page.route('**/rest/v1/categories**', (route) =>
      route.fulfill({ status: 200, json: CATEGORIES.map((c) => ({ ...c, spending_class: null })) })
    )
    await page.reload()

    await expect(page.getByRole('button', { name: /category types/i })).toContainText(
      /unlock budget suggestions/i
    )
  })

  test('offers all five types with their effect on budget suggestions', async ({ page }) => {
    await page.getByRole('button', { name: /category types/i }).click()
    await expect(page.getByText('Category types')).toBeVisible()

    await page.getByRole('button', { name: /Food/ }).first().click()

    const group = page.getByRole('group', { name: /category type for food/i })
    for (const label of ['Essential', 'Commitment', 'Growth', 'Flexible', 'Avoidable']) {
      await expect(group.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }

    // The user must be able to see what each choice actually does.
    await expect(group).toContainText('Never reduced automatically')
    await expect(group).toContainText('trim about 10%')
    await expect(group).toContainText('trim about 20%')
  })

  test('selecting a type marks it as pressed and updates the chip', async ({ page }) => {
    await page.getByRole('button', { name: /category types/i }).click()
    await page.getByRole('button', { name: /Food/ }).first().click()

    const group = page.getByRole('group', { name: /category type for food/i })
    const flexible = group.getByRole('button', { name: /Flexible/ })

    await expect(flexible).toHaveAttribute('aria-pressed', 'false')
    await flexible.click()

    // The row collapses and the chip reflects the new classification.
    await expect(page.getByRole('button', { name: /Food/ }).first()).toContainText('Flexible')
  })

  test('explains that unclassified categories are never auto-reduced', async ({ page }) => {
    await page.getByRole('button', { name: /category types/i }).click()
    await expect(page.getByText(/never reduced automatically/i).first()).toBeVisible()
    await expect(page.getByText(/anything you leave unset is never reduced/i)).toBeVisible()
  })

  test('fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await page.getByRole('button', { name: /category types/i }).click()
    await expect(page.getByText('Category types')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
