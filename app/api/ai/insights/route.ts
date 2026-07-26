import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { consumeAIRateLimit } from '@/lib/ai-rate-limit'
import { buildInsightsForUser, persistInsights } from '@/lib/finance/insights/generate'
import type { AIProvider } from '@/lib/ai-provider'
import type { AIFinancialInsight } from '@/lib/types'

const GENERATE_RATE_LIMIT = 6 // per minute — generation runs a model call

function currentPeriodStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

// Insights the user should see right now: not dismissed, not inside an
// active snooze window, not expired.
function isVisible(insight: AIFinancialInsight, now: Date): boolean {
  if (insight.status === 'dismissed') return false
  if (insight.status === 'snoozed') {
    return insight.snoozed_until ? new Date(insight.snoozed_until) <= now : false
  }
  if (insight.expires_at && new Date(insight.expires_at) < now) return false
  return true
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const refresh = url.searchParams.get('refresh') === '1'
  const now = new Date()
  const periodStart = currentPeriodStart(now)

  const { data: storedRows } = await supabase
    .from('ai_financial_insights')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_start', periodStart)
    .order('created_at', { ascending: false })

  const stored = ((storedRows ?? []) as AIFinancialInsight[]).filter((i) => isVisible(i, now))

  if (!refresh && stored.length > 0) {
    return NextResponse.json({ insights: stored, generated: false })
  }

  const { allowed, retryAfterSeconds } = await consumeAIRateLimit(user.id, 'insights', GENERATE_RATE_LIMIT, 60)
  if (!allowed) {
    // Rate-limited refresh still shows whatever is already stored.
    return NextResponse.json(
      { insights: stored, generated: false, rateLimited: true, retryAfterSeconds },
      { status: 200, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  try {
    const { data: userPref } = await supabase.from('users').select('ai_provider').eq('id', user.id).single()
    const provider = (userPref?.ai_provider as AIProvider) || 'gemini'

    const { insights, preferences, aiRewritten } = await buildInsightsForUser(supabase, user.id, {
      referenceDate: now,
      provider,
    })

    if (!preferences.ai_coach_enabled) {
      return NextResponse.json({ insights: [], generated: false, coachDisabled: true })
    }

    const persisted = await persistInsights(supabase, user.id, insights)
    return NextResponse.json({ insights: persisted, generated: true, aiRewritten })
  } catch (error) {
    console.error('[api/ai/insights] Generation failed:', error)
    return NextResponse.json({ error: 'Could not generate insights right now' }, { status: 500 })
  }
}

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['review', 'accept', 'dismiss', 'snooze']),
  snoozeDays: z.number().int().min(1).max(30).optional(),
})

const STATUS_BY_ACTION = {
  review: 'reviewed',
  accept: 'accepted',
  dismiss: 'dismissed',
  snooze: 'snoozed',
} as const

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { id, action, snoozeDays } = parsed.data
  const update: Record<string, unknown> = { status: STATUS_BY_ACTION[action] }

  if (action === 'snooze') {
    const until = new Date()
    until.setDate(until.getDate() + (snoozeDays ?? 7))
    update.snoozed_until = until.toISOString()
  }

  // The user_id filter is belt-and-braces alongside RLS.
  const { data, error } = await supabase
    .from('ai_financial_insights')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[api/ai/insights] Status update failed:', error)
    return NextResponse.json({ error: 'Could not update insight' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Insight not found' }, { status: 404 })

  return NextResponse.json({ insight: data })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('ai_financial_insights').delete().eq('user_id', user.id)
  if (error) {
    console.error('[api/ai/insights] Delete all failed:', error)
    return NextResponse.json({ error: 'Could not delete insights' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
