import { test as setup } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { STORAGE_STATE, hasCredentials, signIn } from './helpers/auth'

const EMPTY_STATE = { cookies: [], origins: [] }

/**
 * Signs in once for the whole run and saves the session.
 *
 * Every authenticated spec previously signed in through the UI in its own
 * beforeEach. Under parallel workers that meant ~40 concurrent sign-ins
 * against Supabase auth, which rate-limited and produced timeouts that looked
 * like random feature failures. One sign-in, reused everywhere, removes that
 * entirely.
 */
setup('authenticate', async ({ page }) => {
  mkdirSync(dirname(STORAGE_STATE), { recursive: true })

  // The file must exist even without credentials, or projects that reference
  // it fail to start. The specs themselves skip via requiresAuth().
  if (!hasCredentials) {
    writeFileSync(STORAGE_STATE, JSON.stringify(EMPTY_STATE))
    setup.skip(true, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated end-to-end tests.')
    return
  }

  await signIn(page)
  await page.context().storageState({ path: STORAGE_STATE })
})
