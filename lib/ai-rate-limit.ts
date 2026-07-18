import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export interface AIRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

interface RateLimitRow {
  allowed: boolean
  remaining: number
  retry_after_seconds: number
}

export async function consumeAIRateLimit(
  userId: string,
  feature: string,
  maxRequests: number,
  windowSeconds = 60
): Promise<AIRateLimitResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && serviceRoleKey) {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await serviceClient.rpc('consume_ai_rate_limit', {
      p_user_id: userId,
      p_feature: feature,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    })

    if (!error && Array.isArray(data) && data[0]) {
      const row = data[0] as RateLimitRow
      return {
        allowed: row.allowed,
        remaining: row.remaining,
        retryAfterSeconds: row.retry_after_seconds,
      }
    }

    console.warn('[ai-rate-limit] Durable counter unavailable; using process-local fallback')
  }

  const fallback = rateLimit(`ai:${feature}:${userId}`, maxRequests, windowSeconds * 1000)
  return {
    ...fallback,
    retryAfterSeconds: fallback.allowed ? 0 : windowSeconds,
  }
}
