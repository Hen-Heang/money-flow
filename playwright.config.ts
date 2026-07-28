import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const STORAGE_STATE = path.resolve(__dirname, 'e2e/.auth/state.json')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Capped deliberately. Playwright's default (cores/2) ran enough parallel
  // browser contexts alongside the Next server to exhaust machine resources,
  // producing "browserContext.newPage timeout" errors that looked like
  // feature failures. Four is stable and the suite still finishes in ~45s.
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  // A genuinely broken assertion still fails — it just takes longer to give up.
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Signs in once and saves the session. Without this every spec would
    // sign in through the UI in parallel, which rate-limits Supabase auth.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'desktop-chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
    {
      // iPhone 12 Pro Max logical viewport, per the mobile requirements.
      name: 'mobile-428',
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 12 Pro Max'],
        viewport: { width: 428, height: 926 },
        storageState: STORAGE_STATE,
      },
    },
  ],

  // Deliberately a production build rather than `next dev`. The dev server
  // compiles each route on first request, and under parallel workers that
  // produced failures which passed in isolation — flakiness that hides real
  // regressions. Building once up front makes runs deterministic and tests
  // what users actually get.
  //
  // Set PLAYWRIGHT_BASE_URL to skip this and point at a server you already
  // have running (e.g. `npm run dev` while iterating on a single spec).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
