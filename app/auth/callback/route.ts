import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    // A reused/expired code (e.g. prefetch, refresh, back button) returns
    // "flow_state_already_used". If the first exchange already established a
    // session, the cookies are present and getUser() still resolves — so we
    // treat the retry as a no-op and continue to the redirect instead of
    // bouncing the user to "/" with an error param. Only a genuinely failed
    // login (no session at all) is sent back to /login.
    const { data: { user } } = await supabase.auth.getUser()

    if (exchangeError && !user) {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('error', 'auth_failed')
      return NextResponse.redirect(loginUrl)
    }

    if (user) {
      const meta = user.user_metadata ?? {}
      const displayName: string | null =
        typeof meta.full_name === 'string' ? meta.full_name :
        typeof meta.name === 'string' ? meta.name :
        typeof meta.display_name === 'string' ? meta.display_name :
        null
      const avatarUrl: string | null =
        typeof meta.avatar_url === 'string' ? meta.avatar_url :
        typeof meta.picture === 'string' ? meta.picture :
        null

      const { data: existingProfile } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfile) {
        await supabase
          .from('users')
          .update({
            email: user.email || '',
            ...(avatarUrl && { avatar_url: avatarUrl }),
          })
          .eq('id', user.id)
      } else {
        await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            display_name: displayName,
            avatar_url: avatarUrl,
            default_currency: 'KRW',
          })
      }
    }
  }

  const next = searchParams.get('next')
  const redirectTo = next && next.startsWith('/') ? `${origin}${next}` : `${origin}/dashboard`
  return NextResponse.redirect(redirectTo)
}
