import 'server-only'
import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env/server'

/**
 * Service-role client — bypasses RLS entirely. Server-only; every call site
 * that needs elevated access (cron jobs, the Telegram webhook, the AI rate
 * limiter) must go through this factory rather than constructing its own.
 *
 * Returns `null` instead of throwing when unconfigured so callers can return
 * their own explicit "not configured" response (matching existing per-route
 * behavior) rather than crashing with an unhandled exception.
 */
export function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = serverEnv.supabaseServiceRoleKey
  if (!supabaseUrl || !serviceRoleKey) return null

  return createSupabaseJsClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
