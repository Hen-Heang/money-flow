import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUserDetailed, escapeHtml } from '@/lib/telegram'
import { sendMonthlyReportEmail } from '@/lib/email'
import { renderMonthlyReportTelegramMessage } from '@/lib/finance/monthly-report'
import { buildMonthlyReport } from '@/lib/finance/server/monthly-report'
import { loadFinancialPreferences } from '@/lib/finance/server/data'
import { runMonthlyReportCron, type MonthlyReportCronDeps } from '@/lib/finance/server/monthly-report-cron'
import type { MonthlyReportDeliveryChannel } from '@/lib/types'

// Runs daily (see vercel.json). Each user's own report month is resolved
// from their timezone (financial_preferences.quiet_hours.timezone) — a
// monthly-only schedule would send some timezones' reports up to a day
// early or a day late. Delivery is idempotent per (user, month, channel):
// a duplicate run is a no-op once a channel has already been delivered.

function resolveAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const appUrl = resolveAppUrl()
  const now = new Date()

  const deps: MonthlyReportCronDeps = {
    async listEligibleUserIds() {
      const [{ data: linked }, { data: emailOptIn }] = await Promise.all([
        supabase.from('telegram_accounts').select('user_id').not('chat_id', 'is', null),
        supabase.from('financial_preferences').select('user_id').eq('monthly_report_channel_email', true),
      ])
      const ids = new Set<string>()
      for (const row of linked ?? []) ids.add(row.user_id)
      for (const row of emailOptIn ?? []) ids.add(row.user_id)
      return Array.from(ids)
    },

    loadPreferences(userId) {
      return loadFinancialPreferences(supabase, userId)
    },

    async isTelegramLinked(userId) {
      const { data } = await supabase.from('telegram_accounts').select('chat_id').eq('user_id', userId).maybeSingle()
      return Boolean(data?.chat_id)
    },

    async loadAccountEmail(userId) {
      const { data } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
      return data?.email || null
    },

    async loadDeliveredChannels(userId, reportMonth) {
      const { data } = await supabase
        .from('monthly_report_deliveries')
        .select('channel')
        .eq('user_id', userId)
        .eq('report_month', reportMonth)
        .eq('status', 'sent')
      const channels = new Set<MonthlyReportDeliveryChannel>()
      for (const row of data ?? []) channels.add(row.channel as MonthlyReportDeliveryChannel)
      return channels
    },

    buildReport(userId, reportMonth) {
      return buildMonthlyReport(supabase, userId, reportMonth, now)
    },

    renderTelegramMessage(report, reviewUrl) {
      return renderMonthlyReportTelegramMessage(report, escapeHtml, reviewUrl)
    },

    sendTelegram(userId, message) {
      return sendTelegramToUserDetailed(supabase, userId, message)
    },

    async sendEmail(to, report, reviewUrl) {
      const result = await sendMonthlyReportEmail(to, report, reviewUrl)
      return { ok: result.ok, providerMessageId: result.id, error: result.error }
    },

    async recordDelivery(input) {
      const now2 = new Date().toISOString()
      const { error } = await supabase.from('monthly_report_deliveries').upsert(
        {
          user_id: input.userId,
          report_month: input.reportMonth,
          channel: input.channel,
          status: input.status,
          provider_message_id: input.providerMessageId ?? null,
          error_message: input.errorMessage ?? null,
          attempted_at: now2,
          delivered_at: input.status === 'sent' ? now2 : null,
        },
        { onConflict: 'user_id,report_month,channel' }
      )
      if (error) console.error('[cron/monthly-report] Failed to record delivery:', error)
    },

    reviewUrlFor(reportMonth) {
      return `${appUrl}/review?month=${reportMonth}`
    },
  }

  const result = await runMonthlyReportCron(deps, now)
  console.log(
    `[cron/monthly-report] usersEligible=${result.usersEligible} delivered=${result.delivered} failed=${result.failed} skipped=${result.skipped}`
  )
  return NextResponse.json(result)
}
