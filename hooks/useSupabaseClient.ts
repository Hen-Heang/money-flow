import { useMemo } from 'react'
import { createClient } from '@/lib/supabase'

export function useSupabaseClient() {
  return useMemo(() => createClient(), [])
}
