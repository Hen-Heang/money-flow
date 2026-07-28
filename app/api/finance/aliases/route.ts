import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { suggestAliasGroups, normalizeDescription } from '@/lib/finance/analysis'
import { loadTransactions, loadAliases, lookbackStartDate } from '@/lib/finance/server/data'

// Suggested merchant-name merges plus whatever the user has already
// confirmed. Suggestions are derived fresh each time; only confirmations are
// stored, and confirming never rewrites a transaction.
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const referenceDate = new Date()
    const [transactions, aliases] = await Promise.all([
      loadTransactions(supabase, user.id, lookbackStartDate(referenceDate)),
      loadAliases(supabase, user.id),
    ])

    return NextResponse.json({
      suggestions: suggestAliasGroups(transactions, aliases),
      aliases,
    })
  } catch (error) {
    console.error('[api/finance/aliases] Load failed:', error)
    return NextResponse.json({ error: 'Could not load merchant names' }, { status: 500 })
  }
}

const confirmSchema = z.object({
  canonicalDescription: z.string().trim().min(1).max(200),
  /** Every normalized key that should resolve to the canonical name. */
  normalizedKeys: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
})

export async function POST(request: Request) {
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

  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { canonicalDescription, normalizedKeys } = parsed.data

  // Re-normalize server-side so a client can't store a key that would never
  // match a real description.
  const rows = Array.from(new Set(normalizedKeys.map((key) => normalizeDescription(key))))
    .filter(Boolean)
    .map((normalizedKey) => ({
      user_id: user.id,
      normalized_key: normalizedKey,
      canonical_description: canonicalDescription,
      variant_description: canonicalDescription,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No usable descriptions in request' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transaction_description_aliases')
    .upsert(rows, { onConflict: 'user_id,normalized_key' })
    .select('normalized_key, canonical_description')

  if (error) {
    console.error('[api/finance/aliases] Save failed:', error)
    return NextResponse.json({ error: 'Could not save that merge' }, { status: 500 })
  }

  return NextResponse.json({ saved: data?.length ?? 0 })
}

const removeSchema = z.object({
  normalizedKeys: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
})

export async function DELETE(request: Request) {
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

  const parsed = removeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const keys = parsed.data.normalizedKeys.map((key) => normalizeDescription(key)).filter(Boolean)

  const { error } = await supabase
    .from('transaction_description_aliases')
    .delete()
    .eq('user_id', user.id)
    .in('normalized_key', keys)

  if (error) {
    console.error('[api/finance/aliases] Delete failed:', error)
    return NextResponse.json({ error: 'Could not undo that merge' }, { status: 500 })
  }

  return NextResponse.json({ removed: keys.length })
}
