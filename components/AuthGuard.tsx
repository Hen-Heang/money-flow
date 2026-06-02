'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem('searchHistory')
          localStorage.removeItem('budgetReviewDismissed')
        } catch {}
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return null
}
