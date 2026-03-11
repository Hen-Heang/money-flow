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
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfile) {
        await supabase
          .from('users')
          .update({ email: user.email || '' })
          .eq('id', user.id)
      } else {
        await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            display_name: typeof user.user_metadata?.display_name === 'string'
              ? user.user_metadata.display_name
              : null,
            default_currency: 'KRW',
          })
      }
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
