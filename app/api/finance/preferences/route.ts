import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loadFinancialPreferences } from '@/lib/finance/server/data'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const preferences = await loadFinancialPreferences(supabase, user.id)
  return NextResponse.json({ preferences, accountEmail: user.email ?? null })
}

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')

const preferencesSchema = z.object({
  target_savings_rate: z.number().min(0).max(100).optional(),
  monthly_spending_limit_krw: z.number().min(0).max(1_000_000_000).nullable().optional(),
  ai_coach_enabled: z.boolean().optional(),
  weekly_review_enabled: z.boolean().optional(),
  monthly_review_enabled: z.boolean().optional(),
  share_descriptions_with_ai: z.boolean().optional(),
  budget_warning_thresholds: z
    .object({
      first: z.number().min(1).max(200),
      strong: z.number().min(1).max(200),
      over: z.number().min(1).max(200),
    })
    .optional(),
  quiet_hours: z
    .object({
      enabled: z.boolean(),
      start: timeString,
      end: timeString,
      timezone: z.string().min(1).max(64),
    })
    .optional(),
  monthly_report_channel_telegram: z.boolean().optional(),
  monthly_report_channel_email: z.boolean().optional(),
  monthly_report_email: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().email().max(320).nullable().optional()
  ),
})

export async function PUT(request: Request) {
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

  const parsed = preferencesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const thresholds = parsed.data.budget_warning_thresholds
  if (thresholds && !(thresholds.first <= thresholds.strong && thresholds.strong <= thresholds.over)) {
    return NextResponse.json(
      { error: 'Budget warning thresholds must increase: first ≤ strong ≤ over' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('financial_preferences')
    .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    console.error('[api/finance/preferences] Save failed:', error)
    return NextResponse.json({ error: 'Could not save preferences' }, { status: 500 })
  }

  return NextResponse.json({ preferences: data })
}
