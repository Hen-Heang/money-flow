import 'server-only'
import { NextResponse } from 'next/server'

/**
 * Verifies the shared-secret Authorization header sent by Vercel Cron (and
 * the one-time Telegram webhook setup call). Returns a ready-to-return 401
 * response when the check fails, or `null` when the caller is authorized:
 *
 *   const unauthorized = requireCronAuthorization(request)
 *   if (unauthorized) return unauthorized
 *
 * A missing CRON_SECRET is treated the same as a wrong one (401, not 500) —
 * deliberately, so an unauthenticated caller can't distinguish "misconfigured"
 * from "wrong secret".
 */
export function requireCronAuthorization(request: Request): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
