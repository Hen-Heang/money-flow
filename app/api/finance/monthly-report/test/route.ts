import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loadFinancialPreferences } from '@/lib/finance/server/data'
import { buildMonthlyReport } from '@/lib/finance/server/monthly-report'
import { renderMonthlyReportTelegramMessage, resolveTargetReportMonth } from '@/lib/finance/monthly-report'
import { sendTelegramToUserDetailed, escapeHtml } from '@/lib/telegram'
import { sendMonthlyReportEmail } from '@/lib/email'

function resolveAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// Manual "send test report" action from Settings. Sends the most recently
// completed month on whichever channels the user has enabled right now —
// it never reads or writes monthly_report_deliveries, so it can't interfere
// with the cron's idempotency bookkeeping for a real scheduled send.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const preferences = await loadFinancialPreferences(supabase, user.id)
  const wantsTelegram = preferences.monthly_report_channel_telegram
  const wantsEmail = preferences.monthly_report_channel_email

  if (!wantsTelegram && !wantsEmail) {
    return NextResponse.json({ error: 'Enable at least one delivery channel first' }, { status: 400 })
  }

  const reportMonth = resolveTargetReportMonth(new Date(), preferences.quiet_hours.timezone)
  const report = await buildMonthlyReport(supabase, user.id, reportMonth)
  const reviewUrl = `${resolveAppUrl()}/review?month=${reportMonth}`

  const results: { telegram?: { ok: boolean; error?: string }; email?: { ok: boolean; error?: string } } = {}

  if (wantsTelegram) {
    const message = renderMonthlyReportTelegramMessage(report, escapeHtml, reviewUrl)
    const send = await sendTelegramToUserDetailed(supabase, user.id, message)
    results.telegram = { ok: send.ok, error: send.ok ? undefined : send.error || 'No linked Telegram chat' }
  }

  if (wantsEmail) {
    const to = preferences.monthly_report_email || user.email
    if (!to) {
      results.email = { ok: false, error: 'No email address on file' }
    } else {
      const send = await sendMonthlyReportEmail(to, report, reviewUrl)
      results.email = { ok: send.ok, error: send.ok ? undefined : send.error }
    }
  }

  return NextResponse.json({ month: reportMonth, results })
}
