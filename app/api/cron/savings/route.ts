import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramToUser, escapeHtml } from '@/lib/telegram'

// Called by Vercel Cron every day at 9:30 AM Korea time.
// Sends reminders for planned savings contributions without changing balances.
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

  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const currentMonth = kst.toISOString().slice(0, 7)
  const currentDay = kst.getUTCDate()

  // Fetch active plans and filter nullable month states in application code.
  const { data: goals, error: fetchError } = await supabase
    .from('savings_goals')
    .select('id, user_id, name, icon, current_usd, target_usd, auto_monthly_usd, reminder_day, last_reminder_month, last_contribution_month, skipped_month')
    .gt('auto_monthly_usd', 0)
    .lte('reminder_day', currentDay)

  if (fetchError) {
    console.error('[cron/savings] Fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!goals || goals.length === 0) {
    return NextResponse.json({ sent: 0, due: 0, month: currentMonth, day: currentDay })
  }

  const due = goals.filter(goal => (
    Number(goal.current_usd) < Number(goal.target_usd)
    && goal.last_reminder_month !== currentMonth
    && goal.last_contribution_month !== currentMonth
    && goal.skipped_month !== currentMonth
  ))

  let sent = 0
  const errors: string[] = []

  for (const goal of due) {
    const text = [
      `${goal.icon || '🏦'} <b>Monthly savings reminder</b> — ${escapeHtml(goal.name)}`,
      `Planned: $${Number(goal.auto_monthly_usd).toFixed(2)}`,
      `Saved: $${Number(goal.current_usd).toFixed(2)} of $${Number(goal.target_usd).toFixed(2)}`,
      '',
      'After you move the money, open Money Flow and tap <b>Confirm deposit</b>. No balance changes automatically.',
    ].join('\n')

    const attempted = await sendTelegramToUser(supabase, goal.user_id, text).catch(() => false)
    if (!attempted) continue

    const { error } = await supabase
      .from('savings_goals')
      .update({ last_reminder_month: currentMonth })
      .eq('id', goal.id)

    if (error) {
      console.error(`[cron/savings] Reminder state update failed for goal ${goal.id}:`, error)
      errors.push(goal.id)
      continue
    }
    sent++
  }

  console.log(`[cron/savings] Sent ${sent} reminders, ${errors.length} errors`)

  return NextResponse.json({
    sent,
    due: due.length,
    month: currentMonth,
    day: currentDay,
    errors: errors.length > 0 ? errors : undefined,
  })
}
