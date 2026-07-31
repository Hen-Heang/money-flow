import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserProfile, type UserProfileRecord } from '@/lib/profile'
import type { Session } from '@supabase/supabase-js'

let cachedProfile: UserProfileRecord | null = null
let pendingFetch: Promise<UserProfileRecord | null> | null = null

export function invalidateProfileCache() {
  cachedProfile = null
}

export function useUserProfile(): { profile: UserProfileRecord | null; loading: boolean } {
  const [profile, setProfile] = useState<UserProfileRecord | null>(cachedProfile)
  const [loading, setLoading] = useState(cachedProfile === null)

  useEffect(() => {
    if (cachedProfile !== null) return

    if (!pendingFetch) {
      const supabase = createClient()
      pendingFetch = supabase.auth.getSession()
        .then(({ data: { session } }: { data: { session: Session | null } }) => {
          const user = session?.user
          if (!user) return null
          return getUserProfile(supabase, user)
        })
        .then((p: UserProfileRecord | null) => {
          cachedProfile = p
          pendingFetch = null
          return p
        })
        .catch(() => {
          pendingFetch = null
          return null
        })
    }

    // The branch above always assigns pendingFetch when it was null.
    pendingFetch!.then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [])

  return { profile, loading }
}
