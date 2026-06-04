import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUser, fmtKRW, escapeHtml } from '@/lib/telegram'

// Daily budget-alert sweep. For each budget, compares month-to-date spending
// against the limit using the same thresholds as the dashboard (80% / 100%),
// and sends a Telegram alert only when a category crosses to a HIGHER level
// this month — so users get at most one warning and one over-budget ping.
// Secured with CRON_SECRET header check.

function levelFor(spent: number, limit: number): number {
  if (limit <= 0) return 0
  const pct = spent / limit
  if (pct >= 1) return 2
  if (pct >= 0.8) return 1
  return 0
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
  const notifications: Array<Promise<unknown>> = []

  for (const b of budgets) {
    const limit = Number(b.amount_krw)
    const used = spent.get(`${b.user_id}|${b.category_id}`) || 0
    const newLevel = levelFor(used, limit)

    // Effective prior level — reset when the stored month isn't the current one.
    const priorLevel = b.alert_month === month ? Number(b.alert_level) || 0 : 0

    if (newLevel <= priorLevel) {
      // Keep the stored month current so next month resets cleanly.
      if (b.alert_month !== month && (b.alert_level ?? 0) !== 0) {
        await supabase.from('budgets').update({ alert_month: month, alert_level: 0 }).eq('id', b.id)
      }
      continue
    }

    await supabase.from('budgets').update({ alert_month: month, alert_level: newLevel }).eq('id', b.id)

    const cat = b.categories as { name?: string; icon?: string } | null
    const pct = Math.round((used / limit) * 100)
    const head = newLevel === 2 ? '🔴 <b>Over budget</b>' : '🟡 <b>Budget warning</b>'
    const text = [
      head,
      `${cat?.icon || ''} ${escapeHtml(cat?.name || 'Category')}: ${fmtKRW(used)} / ${fmtKRW(limit)} (${pct}%)`,
    ].join('\n')

    notifications.push(sendTelegramToUser(supabase, b.user_id, text).catch(() => false))
    alerted++
  }

  await Promise.all(notifications)
  console.log(`[cron/budget-alerts] Sent ${alerted} alerts`)
  return NextResponse.json({ alerted })
}
