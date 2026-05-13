import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()
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
