import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import LandingPage from './LandingPage'

export default async function RootPage() {
  // Authenticated users skip the marketing page and go straight to the app.
  // This is just a UX redirect, not a security boundary — middleware enforces
  // real auth on /dashboard — so getSession() (local, no network round trip)
  // is enough here and avoids a redundant getUser() call before the one
  // middleware already does for the /dashboard request that follows.
  let isAuthed = false
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getSession()
    isAuthed = !!data.session
  } catch {
    // If auth can't be resolved (e.g. misconfigured env), fall through to landing.
  }

  // redirect() throws NEXT_REDIRECT — keep it out of the try/catch above.
  if (isAuthed) redirect('/dashboard')

  return <LandingPage />
}
