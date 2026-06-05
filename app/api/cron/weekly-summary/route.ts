import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUser, fmtKRW, escapeHtml } from '@/lib/telegram'

// Runs every Monday at 9 AM KST (00:00 UTC).
// Sends last 7 days spending summary with week-over-week comparison.

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
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const shift = (days: number) => {
    const d = new Date(now)
    d.setDate(now.getDate() + days)
    return fmt(d)
  }

  // This week: D-7 to D-1 (yesterday), prev week: D-14 to D-8
  const thisWeekStart = shift(-7)
  const thisWeekEnd = shift(-1)
  const prevWeekStart = shift(-14)
  const prevWeekEnd = shift(-8)

  const { data: linked } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .not('chat_id', 'is', null)

  const userIds = (linked ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return NextResponse.json({ sent: 0 })

  const { data: txns } = await supabase
    .from('transactions')
    .select('user_id, type, amount_krw, date, category_id, categories(name, icon)')
    .in('user_id', userIds)
    .in('type', ['expense', 'income'])
    .gte('date', prevWeekStart)
    .lte('date', thisWeekEnd)

  let sent = 0
  const notifications: Array<Promise<unknown>> = []

  for (const userId of userIds) {
    const all = (txns ?? []).filter((t) => t.user_id === userId)

    const thisWeek = all.filter((t) => t.date >= thisWeekStart && t.date <= thisWeekEnd)
    const prevWeek = all.filter((t) => t.date >= prevWeekStart && t.date <= prevWeekEnd)

    const thisExpense = thisWeek
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
    const thisIncome = thisWeek
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
    const prevExpense = prevWeek
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)

    // Top 3 spending categories this week
    const catMap = new Map<string, { name: string; icon: string; total: number }>()
    for (const t of thisWeek.filter((t) => t.type === 'expense')) {
      const cat = t.categories as { name?: string; icon?: string } | null
      const key = t.category_id || '__none__'
      const prev = catMap.get(key) ?? { name: cat?.name || 'Other', icon: cat?.icon || '•', total: 0 }
      catMap.set(key, { ...prev, total: prev.total + (Number(t.amount_krw) || 0) })
    }
    const top3 = Array.from(catMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)

    // Week-over-week trend
    let trend = ''
    if (prevExpense > 0) {
      const pct = Math.round(((thisExpense - prevExpense) / prevExpense) * 100)
      if (pct > 0) trend = ` ↑${pct}% vs last week`
      else if (pct < 0) trend = ` ↓${Math.abs(pct)}% vs last week`
      else trend = ' same as last week'
    }

    const catLines = top3.map((c) => `  ${c.icon} ${escapeHtml(c.name)}: ${fmtKRW(c.total)}`).join('\n')

    const text = [
      '📊 <b>Weekly summary</b>',
      '',
      `📉 Spent: ${fmtKRW(thisExpense)}${trend}`,
      thisIncome > 0 ? `📈 Earned: ${fmtKRW(thisIncome)}` : '',
      top3.length > 0 ? '\nTop categories:\n' + catLines : '',
      thisWeek.length === 0 ? 'No transactions recorded this week.' : '',
    ].filter(Boolean).join('\n')

    notifications.push(sendTelegramToUser(supabase, userId, text).catch(() => false))
    sent++
  }

  await Promise.all(notifications)
  console.log(`[cron/weekly-summary] Sent ${sent} summaries`)
  return NextResponse.json({ sent })
}
