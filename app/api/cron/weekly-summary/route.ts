import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCronAuthorization } from '@/lib/server/cron'
import { sendTelegramToUser, escapeHtml } from '@/lib/telegram'
import { buildWeeklyCheckIn, renderWeeklyCheckInMessage, isWithinQuietHours } from '@/lib/finance/weekly-checkin'
import {
  loadTransactions,
  loadBudgets,
  loadSavingsGoals,
  loadSavingsContributions,
  loadFinancialPreferences,
} from '@/lib/finance/server/data'

// Runs every Monday at 9 AM KST (00:00 UTC).
// Sends the weekly AI check-in: income, spending, top categories, budget
// progress, unusual expenses, savings progress, and one specific action.
// Every figure comes from the deterministic engine.

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuthorization(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const now = new Date()

  const { data: linked } = await supabase.from('telegram_accounts').select('user_id').not('chat_id', 'is', null)
  const userIds = (linked ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0
  let skipped = 0
  const notifications: Array<Promise<unknown>> = []

  for (const userId of userIds) {
    try {
      const preferences = await loadFinancialPreferences(supabase, userId)
      if (!preferences.weekly_review_enabled) {
        skipped++
        continue
      }
      if (isWithinQuietHours(preferences.quiet_hours, now)) {
        skipped++
        continue
      }

      // Two months of history is enough for the week comparison plus
      // month-to-date budget progress.
      const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const [transactions, budgets, savingsGoals, savingsContributions] = await Promise.all([
        loadTransactions(supabase, userId, fromDate),
        loadBudgets(supabase, userId),
        loadSavingsGoals(supabase, userId),
        loadSavingsContributions(supabase, userId),
      ])

      const checkIn = buildWeeklyCheckIn({
        transactions,
        budgets,
        savingsGoals,
        savingsContributions,
        referenceDate: now,
      })

      // Nothing happened at all — don't send an empty notification.
      if (checkIn.expenseKrw === 0 && checkIn.incomeKrw === 0) {
        skipped++
        continue
      }

      const message = renderWeeklyCheckInMessage(checkIn, escapeHtml)
      notifications.push(sendTelegramToUser(supabase, userId, message).catch(() => false))
      sent++
    } catch (error) {
      console.error(`[cron/weekly-summary] Failed for a user:`, error)
      skipped++
    }
  }

  await Promise.all(notifications)
  console.log(`[cron/weekly-summary] Sent ${sent} check-ins, skipped ${skipped}`)
  return NextResponse.json({ sent, skipped })
}
