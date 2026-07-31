import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { detectSubscriptionCandidates } from '@/lib/finance/analysis'
import { loadTransactions, loadRecurringTemplates, lookbackStartDate } from '@/lib/finance/server/data'
import type { SubscriptionStatusRecord } from '@/lib/types'

// Candidates are always derived fresh from transactions; only the user's
// Keep / Review / Plan to cancel / Cancelled decision is stored.
export async function GET() {
  const { user, supabase } = await requireUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const referenceDate = new Date()
    const [transactions, recurringTemplates, statusResult] = await Promise.all([
      loadTransactions(supabase, user.id, lookbackStartDate(referenceDate)),
      loadRecurringTemplates(supabase, user.id),
      supabase.from('subscription_status').select('id, subscription_key, display_name, status, note').eq('user_id', user.id),
    ])

    const statusByKey = new Map(
      ((statusResult.data ?? []) as SubscriptionStatusRecord[]).map((s) => [s.subscription_key, s])
    )

    const candidates = detectSubscriptionCandidates(transactions, recurringTemplates)
    const subscriptions = candidates.map((candidate) => ({
      ...candidate,
      status: statusByKey.get(candidate.key)?.status ?? 'review',
      note: statusByKey.get(candidate.key)?.note ?? null,
    }))

    const activeSubscriptions = subscriptions.filter((s) => s.status !== 'cancelled')
    const totalYearlyKrw = activeSubscriptions.reduce((sum, s) => sum + s.estimatedYearlyCostKrw, 0)

    return NextResponse.json({
      subscriptions,
      summary: {
        totalCount: subscriptions.length,
        activeCount: activeSubscriptions.length,
        totalYearlyKrw,
        totalMonthlyKrw: Math.round(totalYearlyKrw / 12),
      },
    })
  } catch (error) {
    console.error('[api/finance/subscriptions] Load failed:', error)
    return NextResponse.json({ error: 'Could not load subscriptions' }, { status: 500 })
  }
}

const statusSchema = z.object({
  subscriptionKey: z.string().min(1).max(300),
  displayName: z.string().min(1).max(200),
  status: z.enum(['keep', 'review', 'plan_to_cancel', 'cancelled']),
  note: z.string().max(500).nullable().optional(),
})

// Records the user's decision only. Nothing here cancels a real subscription.
export async function PATCH(request: Request) {
  const { user, supabase } = await requireUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { subscriptionKey, displayName, status, note } = parsed.data

  const { data, error } = await supabase
    .from('subscription_status')
    .upsert(
      {
        user_id: user.id,
        subscription_key: subscriptionKey,
        display_name: displayName,
        status,
        note: note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,subscription_key' }
    )
    .select('id, subscription_key, display_name, status, note')
    .single()

  if (error) {
    console.error('[api/finance/subscriptions] Status update failed:', error)
    return NextResponse.json({ error: 'Could not save subscription status' }, { status: 500 })
  }

  return NextResponse.json({ subscription: data })
}
