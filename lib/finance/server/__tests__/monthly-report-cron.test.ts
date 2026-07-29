import { describe, it, expect, vi } from 'vitest'
import { runMonthlyReportCron, type MonthlyReportCronDeps, type RecordDeliveryInput } from '../monthly-report-cron'
import { computeMonthlyReport } from '@/lib/finance/monthly-report'
import { tx } from '@/lib/finance/analysis/__tests__/fixtures'
import type { FinancialPreferences } from '@/lib/types'

// 2026-08-02T02:00:00Z is Aug 2nd in UTC, so the most recently completed
// month for a UTC user is July.
const NOW = new Date('2026-08-02T02:00:00Z')

function preferences(overrides: Partial<FinancialPreferences> = {}): FinancialPreferences {
  return {
    target_savings_rate: 20,
    monthly_spending_limit_krw: null,
    ai_coach_enabled: true,
    weekly_review_enabled: true,
    monthly_review_enabled: true,
    share_descriptions_with_ai: true,
    budget_warning_thresholds: { first: 70, strong: 90, over: 100 },
    quiet_hours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
    monthly_report_channel_telegram: true,
    monthly_report_channel_email: false,
    monthly_report_email: null,
    ...overrides,
  }
}

function activeReport(month: string) {
  return computeMonthlyReport({
    month,
    transactions: [tx({ type: 'income', amount_krw: 1_000_000, date: `${month}-05` })],
    budgets: [],
    savingsGoals: [],
    savingsContributions: [],
    recurringTemplates: [],
    referenceDate: new Date(`${month}-28T00:00:00Z`),
  })
}

function emptyReport(month: string) {
  return computeMonthlyReport({
    month,
    transactions: [],
    budgets: [],
    savingsGoals: [],
    savingsContributions: [],
    recurringTemplates: [],
    referenceDate: new Date(`${month}-28T00:00:00Z`),
  })
}

function baseDeps(overrides: Partial<MonthlyReportCronDeps> = {}): MonthlyReportCronDeps {
  return {
    listEligibleUserIds: async () => ['user-1'],
    loadPreferences: async () => preferences(),
    isTelegramLinked: async () => true,
    loadAccountEmail: async () => null,
    loadDeliveredChannels: async () => new Set(),
    buildReport: async (_userId, month) => activeReport(month),
    renderTelegramMessage: () => 'rendered message',
    sendTelegram: async () => ({ ok: true, providerMessageId: 'tg-1' }),
    sendEmail: async () => ({ ok: true, providerMessageId: 'em-1' }),
    recordDelivery: async () => {},
    reviewUrlFor: (month) => `https://app.example.com/review?month=${month}`,
    ...overrides,
  }
}

describe('runMonthlyReportCron — idempotency', () => {
  it('does not re-send a channel already delivered this month, even across duplicate cron runs', async () => {
    const deliveredStore = new Set<string>()
    const sendTelegram = vi.fn(async () => ({ ok: true, providerMessageId: 'tg-1' }))

    const deps = baseDeps({
      sendTelegram,
      loadDeliveredChannels: async (userId, month) => {
        const channels = new Set<'telegram' | 'email'>()
        if (deliveredStore.has(`${userId}:telegram:${month}`)) channels.add('telegram')
        return channels
      },
      recordDelivery: async (input) => {
        if (input.status === 'sent') deliveredStore.add(`${input.userId}:${input.channel}:${input.reportMonth}`)
      },
    })

    const first = await runMonthlyReportCron(deps, NOW)
    expect(first.delivered).toBe(1)
    expect(first.usersEligible).toBe(1)
    expect(sendTelegram).toHaveBeenCalledTimes(1)

    // Simulates the cron firing again the same day (e.g. a retry, or a
    // second invocation) — must be a pure no-op, not a duplicate send.
    const second = await runMonthlyReportCron(deps, NOW)
    expect(second.delivered).toBe(0)
    expect(second.skipped).toBe(1)
    expect(sendTelegram).toHaveBeenCalledTimes(1)
  })
})

describe('runMonthlyReportCron — empty months', () => {
  it('skips a user with no income or expenses that month without attempting delivery', async () => {
    const sendTelegram = vi.fn()
    const recordDelivery = vi.fn()
    const deps = baseDeps({
      buildReport: async (_userId, month) => emptyReport(month),
      sendTelegram,
      recordDelivery,
    })

    const result = await runMonthlyReportCron(deps, NOW)
    expect(result.skipped).toBe(1)
    expect(result.delivered).toBe(0)
    expect(result.failed).toBe(0)
    expect(sendTelegram).not.toHaveBeenCalled()
    expect(recordDelivery).not.toHaveBeenCalled()
  })
})

describe('runMonthlyReportCron — preference gating', () => {
  it('skips a user who has turned off monthly review entirely', async () => {
    const sendTelegram = vi.fn()
    const deps = baseDeps({
      loadPreferences: async () => preferences({ monthly_review_enabled: false }),
      sendTelegram,
    })

    const result = await runMonthlyReportCron(deps, NOW)
    expect(result.skipped).toBe(1)
    expect(sendTelegram).not.toHaveBeenCalled()
  })

  it('skips a user with no eligible channel (telegram unlinked, email disabled)', async () => {
    const deps = baseDeps({
      isTelegramLinked: async () => false,
      loadPreferences: async () => preferences({ monthly_report_channel_email: false }),
    })

    const result = await runMonthlyReportCron(deps, NOW)
    expect(result.skipped).toBe(1)
  })

  it('falls back to the account email when no report-specific email is set', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'em-1' }))
    const deps = baseDeps({
      isTelegramLinked: async () => false,
      loadPreferences: async () =>
        preferences({ monthly_report_channel_telegram: false, monthly_report_channel_email: true, monthly_report_email: null }),
      loadAccountEmail: async () => 'account@example.com',
      sendEmail,
    })

    await runMonthlyReportCron(deps, NOW)
    expect(sendEmail).toHaveBeenCalledWith('account@example.com', expect.anything(), expect.any(String))
  })

  it('prefers an explicit report email over the account email', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'em-1' }))
    const deps = baseDeps({
      isTelegramLinked: async () => false,
      loadPreferences: async () =>
        preferences({
          monthly_report_channel_telegram: false,
          monthly_report_channel_email: true,
          monthly_report_email: 'reports@example.com',
        }),
      loadAccountEmail: async () => 'account@example.com',
      sendEmail,
    })

    await runMonthlyReportCron(deps, NOW)
    expect(sendEmail).toHaveBeenCalledWith('reports@example.com', expect.anything(), expect.any(String))
  })
})

describe('runMonthlyReportCron — delivery failures', () => {
  it('isolates one users delivery failure from another and counts both correctly', async () => {
    const recordDelivery = vi.fn(async (input: RecordDeliveryInput) => { void input })
    const deps = baseDeps({
      listEligibleUserIds: async () => ['user-fail', 'user-ok'],
      sendTelegram: async (userId) => {
        if (userId === 'user-fail') throw new Error('Telegram outage — token abcdefghijklmnopqrstuvwxyz1234567890 rejected')
        return { ok: true, providerMessageId: 'tg-ok' }
      },
      recordDelivery,
    })

    const result = await runMonthlyReportCron(deps, NOW)

    expect(result.usersEligible).toBe(2)
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(1)

    const calls = recordDelivery.mock.calls.map((c) => c[0])
    const failedCall = calls.find((c) => c.userId === 'user-fail')
    const okCall = calls.find((c) => c.userId === 'user-ok')

    expect(failedCall?.status).toBe('failed')
    expect(okCall?.status).toBe('sent')
    // Long opaque tokens must never survive into the persisted error message.
    expect(failedCall?.errorMessage).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890')
  })

  it('does not abort the whole run when a single user throws unexpectedly', async () => {
    const sendTelegram = vi.fn(async () => ({ ok: true, providerMessageId: 'tg-1' }))
    const deps = baseDeps({
      listEligibleUserIds: async () => ['user-broken', 'user-ok'],
      loadPreferences: async (userId) => {
        if (userId === 'user-broken') throw new Error('database unavailable')
        return preferences()
      },
      sendTelegram,
    })

    const result = await runMonthlyReportCron(deps, NOW)
    expect(result.failed).toBe(1)
    expect(result.delivered).toBe(1)
    expect(sendTelegram).toHaveBeenCalledTimes(1)
  })

  it('records a failed email delivery when the user has no email on file, without throwing', async () => {
    const recordDelivery = vi.fn(async () => {})
    const deps = baseDeps({
      isTelegramLinked: async () => false,
      loadPreferences: async () =>
        preferences({ monthly_report_channel_telegram: false, monthly_report_channel_email: true, monthly_report_email: null }),
      loadAccountEmail: async () => null,
      recordDelivery,
    })

    const result = await runMonthlyReportCron(deps, NOW)
    expect(result.failed).toBe(1)
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email', status: 'failed', errorMessage: 'No account email on file' })
    )
  })
})
