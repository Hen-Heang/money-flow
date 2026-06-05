import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUser, fmtKRW, escapeHtml } from '@/lib/telegram'

// Sends a daily expense reminder to all Telegram-linked users.
// Called twice: 12 PM KST (03:00 UTC) and 9 PM KST (12:00 UTC).
// Secured with CRON_SECRET header check.

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

  // Determine slot from current UTC hour: 3 = morning (12 PM KST), 12 = evening (9 PM KST)
  const utcHour = new Date().getUTCHours()
  const isMorning = utcHour < 6 // 03:00 UTC slot

  const today = new Date().toISOString().split('T')[0]

  const { data: linked } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .not('chat_id', 'is', null)

  const userIds = (linked ?? []).map((r) => r.user_id)
  if (userIds.length === 0) return NextResponse.json({ sent: 0, message: 'No linked users' })

  // Fetch today's transactions for all linked users in one query
  const { data: txns } = await supabase
    .from('transactions')
    .select('user_id, type, amount_krw, description, categories(icon)')
    .in('user_id', userIds)
    .eq('date', today)

  let sent = 0
  const notifications: Array<Promise<unknown>> = []

  for (const userId of userIds) {
    const userTxns = (txns ?? []).filter((t) => t.user_id === userId)
    const expenses = userTxns.filter((t) => t.type === 'expense')
    const income = userTxns.filter((t) => t.type === 'income')

    const totalExpense = expenses.reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
    const totalIncome = income.reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)

    let text: string

    if (isMorning) {
      // 12 PM KST — midday check-in
      if (userTxns.length === 0) {
        text = [
          '☀️ <b>Midday check-in</b>',
          '',
          'Nothing logged yet today. Remember to record your morning expenses!',
          '',
          'Just type what you spent, e.g. <code>coffee 4500</code>',
        ].join('\n')
      } else {
        const lines = expenses.slice(0, 5).map((t) => {
          const icon = (t.categories as { icon?: string } | null)?.icon || '•'
          return `${icon} ${escapeHtml(t.description)} — ${fmtKRW(Number(t.amount_krw))}`
        })
        text = [
          '☀️ <b>Midday check-in</b>',
          '',
          `${userTxns.length} transaction${userTxns.length > 1 ? 's' : ''} logged so far`,
          totalExpense > 0 ? `📉 Spent: ${fmtKRW(totalExpense)}` : '',
          totalIncome > 0 ? `📈 Earned: ${fmtKRW(totalIncome)}` : '',
          lines.length > 0 ? '\n' + lines.join('\n') : '',
        ].filter(Boolean).join('\n')
      }
    } else {
      // 9 PM KST — end of day wrap-up
      if (userTxns.length === 0) {
        text = [
          '🌙 <b>End of day reminder</b>',
          '',
          "Don't forget to log today's expenses before you sleep!",
          '',
          'Type what you spent, e.g. <code>lunch 12000</code> or <code>transport 1500</code>',
        ].join('\n')
      } else {
        const lines = expenses.slice(0, 5).map((t) => {
          const icon = (t.categories as { icon?: string } | null)?.icon || '•'
          return `${icon} ${escapeHtml(t.description)} — ${fmtKRW(Number(t.amount_krw))}`
        })
        const more = expenses.length > 5 ? `\n+${expenses.length - 5} more` : ''
        text = [
          '🌙 <b>End of day summary</b>',
          '',
          totalExpense > 0 ? `📉 Spent today: ${fmtKRW(totalExpense)}` : '',
          totalIncome > 0 ? `📈 Earned today: ${fmtKRW(totalIncome)}` : '',
          lines.length > 0 ? '\n' + lines.join('\n') + more : '',
          '',
          'Anything else to log? Just type it here.',
        ].filter(Boolean).join('\n')
      }
    }

    notifications.push(sendTelegramToUser(supabase, userId, text).catch(() => false))
    sent++
  }

  await Promise.all(notifications)
  console.log(`[cron/daily-reminder] Sent ${sent} reminders (${isMorning ? 'morning' : 'evening'})`)
  return NextResponse.json({ sent, slot: isMorning ? 'morning' : 'evening' })
}
