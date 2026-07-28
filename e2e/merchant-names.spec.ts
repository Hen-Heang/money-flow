import { test, expect } from '@playwright/test'
import { requiresAuth, expectNoHorizontalOverflow } from './helpers/auth'
import { mockSubscriptions } from './helpers/mocks'

const ALIASES_PAYLOAD = {
  suggestions: [
    {
      id: 'claude',
      suggestedCanonical: 'Claude',
      confidence: 'exact',
      occurrenceCount: 3,
      totalKrw: 81000,
      members: [
        { normalizedKey: 'claude', sample: 'Claude', variants: ['Claude', 'claude', 'CLAUDE'], count: 3, totalKrw: 81000 },
      ],
    },
    {
      id: 'claude|claude ai pro',
      suggestedCanonical: 'Claude AI Pro',
      confidence: 'likely',
      occurrenceCount: 4,
      totalKrw: 108000,
      members: [
        { normalizedKey: 'claude ai pro', sample: 'Claude AI Pro', variants: ['Claude AI Pro'], count: 1, totalKrw: 27000 },
        { normalizedKey: 'claude', sample: 'Claude', variants: ['Claude'], count: 3, totalKrw: 81000 },
      ],
    },
  ],
  aliases: [{ normalizedKey: 'coupang', canonicalDescription: 'Coupang' }],
}

test.describe('Merchant name grouping', () => {
  test.beforeEach(async ({ page }) => {
    requiresAuth()
    await mockSubscriptions(page)
    await page.route('**/api/finance/aliases**', async (route) => {
      const method = route.request().method()
      if (method === 'POST') return route.fulfill({ status: 200, json: { saved: 1 } })
      if (method === 'DELETE') return route.fulfill({ status: 200, json: { removed: 1 } })
      return route.fulfill({ status: 200, json: ALIASES_PAYLOAD })
    })
    await page.goto('/subscriptions')
    await page.getByRole('button', { name: /merchant names/i }).click()
  })

  test('lists suggested groups with their variants and totals', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Merchant names' })
    await expect(dialog).toBeVisible()

    const suggested = dialog.getByRole('region', { name: /suggested groups/i })
    await expect(suggested).toContainText('Same name, different spacing')
    await expect(suggested).toContainText('“claude”')
    await expect(suggested).toContainText('“CLAUDE”')
    await expect(suggested).toContainText('3 transactions')
    await expect(suggested).toContainText('₩81,000')
  })

  test('warns more cautiously about differently-spelled merchants', async ({ page }) => {
    const suggested = page.getByRole('region', { name: /suggested groups/i })
    await expect(suggested).toContainText('Possibly the same merchant')
    await expect(suggested).toContainText(/only group them if they really are the same shop/i)
  })

  test('lets the user rename the merged group before confirming', async ({ page }) => {
    // Exact — this label is a prefix of "Merged name for Claude AI Pro".
    const nameInput = page.getByLabel('Merged name for Claude', { exact: true })
    await expect(nameInput).toHaveValue('Claude')

    await nameInput.fill('Claude AI')
    await expect(nameInput).toHaveValue('Claude AI')
  })

  test('keeping them separate removes the suggestion without saving anything', async ({ page }) => {
    const suggested = page.getByRole('region', { name: /suggested groups/i })
    await expect(suggested).toContainText('Same name, different spacing')

    await suggested.getByRole('button', { name: /keep separate/i }).first().click()
    await expect(suggested).not.toContainText('Same name, different spacing')
  })

  test('shows already-confirmed groups with a way to undo them', async ({ page }) => {
    const confirmed = page.getByRole('region', { name: /confirmed groups/i })
    await expect(confirmed).toContainText('Coupang')
    await expect(confirmed).toContainText('1 spelling grouped')
    await expect(confirmed.getByRole('button', { name: /ungroup coupang/i })).toBeVisible()
  })

  test('states that transactions are never edited', async ({ page }) => {
    await expect(page.getByText(/your transactions are never edited/i)).toBeVisible()
  })

  test('fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await expect(page.getByRole('dialog', { name: 'Merchant names' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
