import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from '@/lib/telegram'

// Called by Vercel Cron on the 1st of each month at 9:30 AM.
// Applies auto-monthly deposits to savings goals for all users.
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

  const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  // Fetch all auto-deposit goals not yet processed this month
  const { data: goals, error: fetchError } = await supabase
    .from('savings_goals')
    .select('id, current_usd, target_usd, auto_monthly_usd, last_auto_month')
    .gt('auto_monthly_usd', 0)
    .or(`last_auto_month.is.null,last_auto_month.neq.${currentMonth}`)

  if (fetchError) {
    console.error('[cron/savings] Fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!goals || goals.length === 0) {
    return NextResponse.json({ applied: 0, message: 'No auto-deposits due' })
  }

  // Only process goals that haven't reached their target
  const due = goals.filter((g: { current_usd: number; target_usd: number }) => g.current_usd < g.target_usd)

  let applied = 0
  const errors: string[] = []

  for (const goal of due) {
    const newTotal = Math.min(goal.current_usd + goal.auto_monthly_usd, goal.target_usd)
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_usd: newTotal, last_auto_month: currentMonth })
      .eq('id', goal.id)

    if (error) {
      console.error(`[cron/savings] Update failed for goal ${goal.id}:`, error)
      errors.push(goal.id)
      continue
    }
    applied++
  }

  console.log(`[cron/savings] Applied ${applied} auto-deposits, ${errors.length} errors`)

  if (applied > 0) {
    await sendTelegramMessage(
      `🏦 *Savings Auto-Deposit*\n${applied} goal${applied > 1 ? 's' : ''} received their monthly deposit.`
    )
  }

  return NextResponse.json({ applied, errors: errors.length > 0 ? errors : undefined })
}
