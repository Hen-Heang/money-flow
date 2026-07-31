import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Resolves the current request's authenticated user via the session cookie.
 * Every route decides its own "unauthorized" response (some return
 * `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`, others a
 * plain `Response`), so this only removes the duplicated client+lookup, not
 * the response itself:
 *
 *   const { user, supabase } = await requireUser()
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 */
export async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { user, supabase }
}
