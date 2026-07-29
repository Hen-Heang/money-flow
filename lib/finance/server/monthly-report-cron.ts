// Core monthly-report cron logic, decoupled from Supabase/Telegram/Resend via
// a `MonthlyReportCronDeps` port. The route wires real implementations; tests
// wire fakes — no need to mock the Supabase query builder to exercise the
// idempotency, timezone, empty-month and failure-isolation behaviour.

import { resolveTargetReportMonth } from '@/lib/finance/monthly-report'
import type { MonthlyReport } from '@/lib/finance/monthly-report'
import type { FinancialPreferences, MonthlyReportDeliveryChannel } from '@/lib/types'

export interface DeliverySendResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

export interface RecordDeliveryInput {
  userId: string
  reportMonth: string
  channel: MonthlyReportDeliveryChannel
  status: 'sent' | 'failed'
  providerMessageId?: string
  errorMessage?: string
}

export interface MonthlyReportCronDeps {
  /** Users who could plausibly need a report: telegram-linked or email opted in. */
  listEligibleUserIds(): Promise<string[]>
  loadPreferences(userId: string): Promise<FinancialPreferences>
  isTelegramLinked(userId: string): Promise<boolean>
  /** The account's own email, used when no report-specific email is set. */
  loadAccountEmail(userId: string): Promise<string | null>
  /** Channels already successfully delivered for this user + month. */
  loadDeliveredChannels(userId: string, reportMonth: string): Promise<Set<MonthlyReportDeliveryChannel>>
  buildReport(userId: string, reportMonth: string): Promise<MonthlyReport>
  renderTelegramMessage(report: MonthlyReport, reviewUrl: string): string
  sendTelegram(userId: string, message: string): Promise<DeliverySendResult>
  sendEmail(to: string, report: MonthlyReport, reviewUrl: string): Promise<DeliverySendResult>
  recordDelivery(input: RecordDeliveryInput): Promise<void>
  reviewUrlFor(reportMonth: string): string
}

export interface MonthlyReportCronResult {
  usersEligible: number
  delivered: number
  failed: number
  skipped: number
}

// Never persist anything that looks like a token/secret, and cap length —
// this column is readable by the user via RLS.
function sanitizeError(message: string | undefined): string {
  if (!message) return 'Unknown error'
  return message.replace(/[A-Za-z0-9_-]{20,}/g, '[redacted]').slice(0, 500)
}

async function deliverChannel(
  deps: MonthlyReportCronDeps,
  userId: string,
  reportMonth: string,
  channel: MonthlyReportDeliveryChannel,
  send: () => Promise<DeliverySendResult>
): Promise<'delivered' | 'failed'> {
  try {
    const result = await send()
    await deps.recordDelivery({
      userId,
      reportMonth,
      channel,
      status: result.ok ? 'sent' : 'failed',
      providerMessageId: result.providerMessageId,
      errorMessage: result.ok ? undefined : sanitizeError(result.error),
    })
    return result.ok ? 'delivered' : 'failed'
  } catch (err) {
    // A delivery that throws (network error, provider outage) is recorded
    // the same as an explicit failure — it must never crash the run.
    await deps
      .recordDelivery({
        userId,
        reportMonth,
        channel,
        status: 'failed',
        errorMessage: sanitizeError(err instanceof Error ? err.message : String(err)),
      })
      .catch(() => undefined)
    return 'failed'
  }
}

export async function runMonthlyReportCron(
  deps: MonthlyReportCronDeps,
  now: Date = new Date()
): Promise<MonthlyReportCronResult> {
  const result: MonthlyReportCronResult = { usersEligible: 0, delivered: 0, failed: 0, skipped: 0 }
  const userIds = await deps.listEligibleUserIds()

  for (const userId of userIds) {
    try {
      const preferences = await deps.loadPreferences(userId)
      if (!preferences.monthly_review_enabled) {
        result.skipped++
        continue
      }

      const telegramLinked = preferences.monthly_report_channel_telegram && (await deps.isTelegramLinked(userId))
      const emailEnabled = preferences.monthly_report_channel_email
      if (!telegramLinked && !emailEnabled) {
        result.skipped++
        continue
      }

      const reportMonth = resolveTargetReportMonth(now, preferences.quiet_hours.timezone)
      const delivered = await deps.loadDeliveredChannels(userId, reportMonth)

      const wantsTelegram = telegramLinked && !delivered.has('telegram')
      const wantsEmail = emailEnabled && !delivered.has('email')
      if (!wantsTelegram && !wantsEmail) {
        // Nothing left to do for this user this month — already delivered
        // on every enabled channel. Handles duplicate cron runs cleanly.
        result.skipped++
        continue
      }

      const report = await deps.buildReport(userId, reportMonth)
      if (!report.hasActivity) {
        // Nothing happened that month — don't send an empty notification,
        // and don't record a delivery attempt (next real month still can).
        result.skipped++
        continue
      }

      result.usersEligible++
      const reviewUrl = deps.reviewUrlFor(reportMonth)

      if (wantsTelegram) {
        const outcome = await deliverChannel(deps, userId, reportMonth, 'telegram', () =>
          deps.sendTelegram(userId, deps.renderTelegramMessage(report, reviewUrl))
        )
        if (outcome === 'delivered') result.delivered++
        else result.failed++
      }

      if (wantsEmail) {
        const email = preferences.monthly_report_email || (await deps.loadAccountEmail(userId))
        if (!email) {
          result.failed++
          await deps
            .recordDelivery({ userId, reportMonth, channel: 'email', status: 'failed', errorMessage: 'No account email on file' })
            .catch(() => undefined)
        } else {
          const outcome = await deliverChannel(deps, userId, reportMonth, 'email', () => deps.sendEmail(email, report, reviewUrl))
          if (outcome === 'delivered') result.delivered++
          else result.failed++
        }
      }
    } catch (err) {
      // One user's unexpected failure (e.g. a data-load error) must never
      // stop the run for everyone else.
      console.error(`[monthly-report-cron] Failed for a user:`, err)
      result.failed++
    }
  }

  return result
}
