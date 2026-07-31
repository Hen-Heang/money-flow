import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCronAuthorization } from '@/lib/server/cron'
import { sendTelegramToUser, fmtKRW, escapeHtml } from '@/lib/telegram'
import { loadFinancialPreferences } from '@/lib/finance/server/data'
import { isWithinQuietHours } from '@/lib/finance/weekly-checkin'
import type { FinancialPreferences } from '@/lib/types'

// Daily budget-alert sweep. Compares month-to-date spending against each
// budget and alerts only when a category crosses to a HIGHER level this
// month — so the user gets at most one alert per level, never a daily
// repeat of the same warning.
//
// Levels (thresholds are per-user configurable in AI settings):
//   1 = first warning (default 70%)
//   2 = strong warning (default 90%)
//   3 = over budget (default 100%)

function levelFor(spent: number, limit: number, thresholds: FinancialPreferences['budget_warning_thresholds']): number {
  if (limit <= 0) return 0
  const pct = (spent / limit) * 100
  if (pct >= thresholds.over) return 3
  if (pct >= thresholds.strong) return 2
  if (pct >= thresholds.first) return 1
  return 0
}

const LEVEL_HEADING: Record<number, string> = {
  1: '🟡 <b>Budget check-in</b>',
  2: '🟠 <b>Approaching the limit</b>',
  3: '🔴 <b>Over the plan</b>',
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuthorization(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const now = new Date()
  const month = now.toISOString().slice(0, 7) // 'YYYY-MM'
  const monthStart = `${month}-01`

  // Only consider users who have Telegram linked — no point computing for others.
  const { data: linked } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .not('chat_id', 'is', null)

  const userIds = (linked ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return NextResponse.json({ alerted: 0, message: 'No linked users' })

  const { data: budgets, error: budgetErr } = await supabase
    .from('budgets')
    .select('id, user_id, category_id, amount_krw, alert_month, alert_level, categories(name, icon)')
    .in('user_id', userIds)
    .gt('amount_krw', 0)

  if (budgetErr) {
    console.error('[cron/budget-alerts] budget fetch error:', budgetErr)
    return NextResponse.json({ error: budgetErr.message }, { status: 500 })
  }
  if (!budgets || budgets.length === 0) return NextResponse.json({ alerted: 0, message: 'No budgets' })

  // Per-user thresholds and quiet hours, fetched once each.
  const preferencesByUser = new Map<string, FinancialPreferences>()
  await Promise.all(
    userIds.map(async (userId) => {
      preferencesByUser.set(userId, await loadFinancialPreferences(supabase, userId))
    })
  )

  // Month-to-date expenses for these users, summed per (user, category).
  const { data: txns } = await supabase
    .from('transactions')
    .select('user_id, category_id, amount_krw')
    .in('user_id', userIds)
    .eq('type', 'expense')
    .gte('date', monthStart)

  const spent = new Map<string, number>() // key: `${user_id}|${category_id}`
  for (const t of txns ?? []) {
    if (!t.category_id) continue
    const key = `${t.user_id}|${t.category_id}`
    spent.set(key, (spent.get(key) || 0) + (Number(t.amount_krw) || 0))
  }

  let alerted = 0
  let quietSkipped = 0
  const notifications: Array<Promise<unknown>> = []

  for (const b of budgets) {
    const preferences = preferencesByUser.get(b.user_id)
    if (!preferences) continue

    const limit = Number(b.amount_krw)
    const used = spent.get(`${b.user_id}|${b.category_id}`) || 0
    const newLevel = levelFor(used, limit, preferences.budget_warning_thresholds)

    // Effective prior level — reset when the stored month isn't the current one.
    const priorLevel = b.alert_month === month ? Number(b.alert_level) || 0 : 0

    if (newLevel <= priorLevel) {
      // Keep the stored month current so next month resets cleanly.
      if (b.alert_month !== month && (b.alert_level ?? 0) !== 0) {
        await supabase.from('budgets').update({ alert_month: month, alert_level: 0 }).eq('id', b.id)
      }
      continue
    }

    // Record the level even while quiet so the user isn't hit with a backlog
    // of every threshold once quiet hours end.
    await supabase.from('budgets').update({ alert_month: month, alert_level: newLevel }).eq('id', b.id)

    if (isWithinQuietHours(preferences.quiet_hours, now)) {
      quietSkipped++
      continue
    }

    const cat = b.categories as { name?: string; icon?: string } | null
    const pct = Math.round((used / limit) * 100)
    const remaining = limit - used

    const text = [
      LEVEL_HEADING[newLevel],
      `${cat?.icon || ''} ${escapeHtml(cat?.name || 'Category')}: ${fmtKRW(used)} / ${fmtKRW(limit)} (${pct}%)`,
      newLevel === 3
        ? `This category exceeded its plan by ${fmtKRW(Math.abs(remaining))}.`
        : `${fmtKRW(remaining)} left in this month's plan.`,
    ].join('\n')

    notifications.push(sendTelegramToUser(supabase, b.user_id, text).catch(() => false))
    alerted++
  }

  await Promise.all(notifications)
  console.log(`[cron/budget-alerts] Sent ${alerted} alerts, ${quietSkipped} held for quiet hours`)
  return NextResponse.json({ alerted, quietSkipped })
}
