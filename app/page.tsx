import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LandingPage from './LandingPage'

export default async function RootPage() {
  // Authenticated users skip the marketing page and go straight to the app.
  let isAuthed = false
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    isAuthed = !!data.user
  } catch {
    // If auth can't be resolved (e.g. misconfigured env), fall through to landing.
  }

  // redirect() throws NEXT_REDIRECT — keep it out of the try/catch above.
  if (isAuthed) redirect('/dashboard')

  return <LandingPage />
}
