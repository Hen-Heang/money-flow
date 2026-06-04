import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUser, fmtKRW, escapeHtml } from '@/lib/telegram'

// This route is called by Vercel Cron (or any scheduler) — NOT by users.
// It uses the service role key to apply recurring transactions for ALL active users.
// Secured with CRON_SECRET header check.

function advanceDate(dateStr: string, frequency: string): string {
  const date = new Date(dateStr)
  switch (frequency) {
    case 'daily':   date.setDate(date.getDate() + 1); break
    case 'weekly':  date.setDate(date.getDate() + 7); break
    case 'monthly': {
      const originalDay = date.getDate()
      date.setDate(1)
      date.setMonth(date.getMonth() + 1)
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      date.setDate(Math.min(originalDay, daysInMonth))
      break
    }
    case 'yearly': {
      const originalDay = date.getDate()
      date.setDate(1)
      date.setFullYear(date.getFullYear() + 1)
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      date.setDate(Math.min(originalDay, daysInMonth))
      break
    }
  }
  return date.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  // Verify cron secret
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

  // Service role client — bypasses RLS, acts as admin
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const today = new Date().toISOString().split('T')[0]

  // Find ALL active recurring rules that are due across all users
  const { data: due, error: fetchError } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .lte('next_date', today)

  if (fetchError) {
    console.error('[cron/recurring] Fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ applied: 0, message: 'No recurring transactions due' })
  }

  let applied = 0
  const errors: string[] = []
  // Collect per-user applied items so we can send one Telegram summary each.
  const appliedByUser = new Map<string, Array<{ description: string; type: string; amount_krw: number }>>()

  for (const rule of due) {
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: rule.user_id,
      type: rule.type,
      amount_krw: rule.amount_krw,
      amount_usd: rule.amount_usd,
      exchange_rate: rule.exchange_rate,
      currency: rule.currency,
      description: rule.description,
      category_id: rule.category_id,
      payment_method_id: rule.payment_method_id,
      note: rule.note,
      date: rule.next_date,
    })

    if (insertError) {
      console.error(`[cron/recurring] Insert failed for rule ${rule.id}:`, insertError)
      errors.push(rule.id)
      continue
    }

    await supabase
      .from('recurring_transactions')
      .update({ next_date: advanceDate(rule.next_date, rule.frequency), last_applied: rule.next_date })
      .eq('id', rule.id)

    const list = appliedByUser.get(rule.user_id) ?? []
    list.push({ description: rule.description, type: rule.type, amount_krw: Number(rule.amount_krw) || 0 })
    appliedByUser.set(rule.user_id, list)
    applied++
  }

  // Best-effort Telegram notifications (never block the cron result).
  await Promise.all(
    Array.from(appliedByUser.entries()).map(([userId, items]) => {
      const lines = items.map((i) => {
        const sign = i.type === 'income' ? '+' : '−'
        return `• ${escapeHtml(i.description)} ${sign}${fmtKRW(i.amount_krw)}`
      })
      const text = [`🔁 <b>Recurring applied</b> (${items.length})`, '', ...lines].join('\n')
      return sendTelegramToUser(supabase, userId, text).catch(() => false)
    }),
  )

  console.log(`[cron/recurring] Applied ${applied} transactions, ${errors.length} errors`)

  return NextResponse.json({ applied, errors: errors.length > 0 ? errors : undefined })
}
