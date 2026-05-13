import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { neon } from '@neondatabase/serverless'

export const runtime = 'nodejs'
export const maxDuration = 60

// Runs daily — syncs all Supabase tables to Neon as a backup.
// Upserts rows by id so re-runs are safe and idempotent.

const TABLE_ORDER = [
  'users',
  'categories',
  'payment_methods',
  'recurring_transactions',
  'transactions',
  'exchange_rates',
  'budgets',
  'savings_goals',
  'transaction_templates',
  'push_subscriptions',
] as const

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const neonUrl = process.env.NEON_DATABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }
  if (!neonUrl) {
    return NextResponse.json({ error: 'NEON_DATABASE_URL not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const cleanNeonUrl = neonUrl.replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?$/, '')
  const sql = neon(cleanNeonUrl)

  const results: Record<string, { synced: number; error?: string }> = {}

  for (const table of TABLE_ORDER) {
    try {
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw error
      if (!data || data.length === 0) {
        results[table] = { synced: 0 }
        continue
      }

      const keys = Object.keys(data[0])
      const cols = keys.map(k => `"${k}"`).join(', ')
      const updates = keys
        .filter(k => k !== 'id')
        .map(k => `"${k}" = EXCLUDED."${k}"`)
        .join(', ')

      let synced = 0
      // Batch in chunks of 100 to avoid query size limits
      for (let i = 0; i < data.length; i += 100) {
        const chunk = data.slice(i, i + 100)
        const placeholders = chunk
          .map((_, ri) => `(${keys.map((_, ci) => `$${ri * keys.length + ci + 1}`).join(', ')})`)
          .join(', ')
        const values = chunk.flatMap(row => keys.map(k => row[k] ?? null))

        await sql(
          `INSERT INTO ${table} (${cols}) VALUES ${placeholders}
           ON CONFLICT (id) DO UPDATE SET ${updates}`,
          values
        )
        synced += chunk.length
      }

      results[table] = { synced }
    } catch (err) {
      results[table] = { synced: 0, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0)
  const errors = Object.entries(results).filter(([, r]) => r.error)

  return NextResponse.json({
    synced_at: new Date().toISOString(),
    total_synced: totalSynced,
    tables: results,
    ...(errors.length > 0 && { errors: Object.fromEntries(errors) }),
  })
}
