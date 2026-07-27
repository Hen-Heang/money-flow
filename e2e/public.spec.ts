import { test, expect } from '@playwright/test'
import { expectNoHorizontalOverflow } from './helpers/auth'

// These run without credentials — they cover the auth boundary and the
// responsive baseline that every other page inherits.
//
// Explicitly anonymous: the other projects load a signed-in session, which
// would defeat the point of asserting that protected routes redirect.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication boundary', () => {
  test('protected routes redirect an anonymous visitor to login', async ({ page }) => {
    for (const path of ['/dashboard', '/subscriptions', '/review', '/settings/ai']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('the intended destination is preserved for after sign-in', async ({ page }) => {
    await page.goto('/subscriptions')
    await expect(page).toHaveURL(/next=%2Fsubscriptions/)
  })
})

test.describe('Login page responsiveness', () => {
  test('renders without horizontal overflow', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('interactive controls meet the 44px touch target minimum', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-428', 'Touch target sizing is a mobile requirement.')

    await page.goto('/login')
    const submit = page.getByRole('button', { name: /sign in|log in/i }).first()
    const box = await submit.boundingBox()

    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('API auth', () => {
  test('finance endpoints reject unauthenticated requests', async ({ request }) => {
    for (const path of [
      '/api/ai/insights',
      '/api/finance/subscriptions',
      '/api/finance/budget-plan',
      '/api/finance/goal-plans',
      '/api/finance/preferences',
      '/api/finance/monthly-review',
    ]) {
      const response = await request.get(path)
      expect(response.status(), `${path} should require authentication`).toBe(401)
    }
  })

  test('insight status updates reject unauthenticated requests', async ({ request }) => {
    const response = await request.patch('/api/ai/insights', {
      data: { id: '11111111-1111-4111-8111-111111111111', action: 'dismiss' },
    })
    expect(response.status()).toBe(401)
  })
})
