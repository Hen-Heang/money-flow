import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCronAuthorization } from '@/lib/server/cron'
import { sendTelegramToUser, fmtKRW } from '@/lib/telegram'

// Runs daily at 9 PM KST (12:00 UTC).
// Alerts when today's spending exceeds 2x the daily average for the month.

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuthorization(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'
  const dayOfMonth = now.getUTCDate()

  // Need at least 3 days of history for a meaningful average
  if (dayOfMonth < 3) return NextResponse.json({ alerted: 0, message: 'Too early in month for spike detection' })

  const { data: linked } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .not('chat_id', 'is', null)

  const userIds = (linked ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return NextResponse.json({ alerted: 0 })

  const { data: txns } = await supabase
    .from('transactions')
    .select('user_id, amount_krw, date')
    .in('user_id', userIds)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lte('date', today)

  let alerted = 0
  const notifications: Array<Promise<unknown>> = []

  for (const userId of userIds) {
    const userTxns = (txns ?? []).filter((t) => t.user_id === userId)

    const todayTotal = userTxns
      .filter((t) => t.date === today)
      .reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)

    if (todayTotal === 0) continue

    const monthTotal = userTxns.reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
    const dailyAvg = monthTotal / dayOfMonth

    // Only alert if average is meaningful (> ₩1,000/day) and today is a real spike
    if (dailyAvg < 1000 || todayTotal < dailyAvg * 2) continue

    const multiplier = (todayTotal / dailyAvg).toFixed(1)
    const text = [
      '⚠️ <b>High spending day</b>',
      '',
      `Spent today: ${fmtKRW(todayTotal)}`,
      `Daily average: ${fmtKRW(Math.round(dailyAvg))}`,
      `That's <b>${multiplier}×</b> your usual daily spending.`,
    ].join('\n')

    notifications.push(sendTelegramToUser(supabase, userId, text).catch(() => false))
    alerted++
  }

  await Promise.all(notifications)
  console.log(`[cron/spending-spike] Sent ${alerted} alerts`)
  return NextResponse.json({ alerted })
}
