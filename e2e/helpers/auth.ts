import { test, type Page } from '@playwright/test'

export const E2E_EMAIL = process.env.E2E_EMAIL
export const E2E_PASSWORD = process.env.E2E_PASSWORD

export const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD)

/**
 * Skips the current test when E2E credentials aren't configured.
 *
 * Authenticated routes are protected by the Supabase-cookie middleware in
 * proxy.ts, so there is no way to reach them without a real session. Skipping
 * (rather than silently passing) keeps the gap visible in the report.
 */
export function requiresAuth() {
  test.skip(
    !hasCredentials,
    'Set E2E_EMAIL and E2E_PASSWORD to run authenticated end-to-end tests.'
  )
}

export async function signIn(page: Page) {
  await page.goto('/login')

  await page.getByPlaceholder(/email/i).fill(E2E_EMAIL!)
  await page.getByPlaceholder(/password/i).first().fill(E2E_PASSWORD!)
  await page.getByRole('button', { name: /sign in|log in/i }).first().click()

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
}

/** Fails the test if the page scrolls horizontally at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })

  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    throw new Error(
      `Horizontal overflow: content is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport.`
    )
  }
}
