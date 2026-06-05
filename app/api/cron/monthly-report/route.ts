import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUser, fmtKRW, escapeHtml } from '@/lib/telegram'

// Runs on the 1st of every month at 9 AM KST (00:00 UTC).
// Reports on the previous month: income, expenses, savings rate, top category.

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
  // Previous month range
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const monthStart = fmt(firstOfPrevMonth)
  const monthEnd = fmt(lastOfPrevMonth)
  const monthName = firstOfPrevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const { data: linked } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .not('chat_id', 'is', null)

  const userIds = (linked ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return NextResponse.json({ sent: 0 })

  const { data: txns } = await supabase
    .from('transactions')
    .select('user_id, type, amount_krw, category_id, categories(name, icon)')
    .in('user_id', userIds)
    .gte('date', monthStart)
    .lte('date', monthEnd)

  let sent = 0
  const notifications: Array<Promise<unknown>> = []

  for (const userId of userIds) {
    const all = (txns ?? []).filter((t) => t.user_id === userId)
    if (all.length === 0) continue

    const totalIncome = all
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
    const totalExpense = all
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
    const saved = totalIncome - totalExpense
    const savingsRate = totalIncome > 0 ? Math.round((saved / totalIncome) * 100) : 0

    // Top spending category
    const catMap = new Map<string, { name: string; icon: string; total: number }>()
    for (const t of all.filter((t) => t.type === 'expense')) {
      const cat = t.categories as { name?: string; icon?: string } | null
      const key = t.category_id || '__none__'
      const prev = catMap.get(key) ?? { name: cat?.name || 'Other', icon: cat?.icon || '•', total: 0 }
      catMap.set(key, { ...prev, total: prev.total + (Number(t.amount_krw) || 0) })
    }
    const topCat = Array.from(catMap.values()).sort((a, b) => b.total - a.total)[0]

    const savingsEmoji = savingsRate >= 30 ? '🎉' : savingsRate >= 10 ? '👍' : '😬'
    const savedLine = saved >= 0
      ? `💰 Saved: ${fmtKRW(saved)} (${savingsRate}%) ${savingsEmoji}`
      : `⚠️ Overspent: ${fmtKRW(Math.abs(saved))}`

    const text = [
      `📅 <b>${monthName} recap</b>`,
      '',
      totalIncome > 0 ? `📈 Income: ${fmtKRW(totalIncome)}` : '',
      totalExpense > 0 ? `📉 Spent: ${fmtKRW(totalExpense)}` : '',
      savedLine,
      topCat ? `\n🏆 Biggest: ${topCat.icon} ${escapeHtml(topCat.name)} ${fmtKRW(topCat.total)}` : '',
    ].filter(Boolean).join('\n')

    notifications.push(sendTelegramToUser(supabase, userId, text).catch(() => false))
    sent++
  }

  await Promise.all(notifications)
  console.log(`[cron/monthly-report] Sent ${sent} reports`)
  return NextResponse.json({ sent })
}
