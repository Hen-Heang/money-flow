import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase'

type SupabaseClient = ReturnType<typeof createClient>

export interface UserProfileRecord {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  default_currency: string
  created_at?: string
}

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { data: existing, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<UserProfileRecord>()

  if (error) throw error

  if (existing) {
    if (existing.email !== (user.email || '')) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ email: user.email || '' })
        .eq('id', user.id)

      if (updateError) throw updateError
    }

    return existing
  }

  const profile = {
    id: user.id,
    email: user.email || '',
    display_name: typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : null,
    avatar_url: null,
    default_currency: 'KRW',
  }

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert(profile)
    .select('*')
    .single<UserProfileRecord>()

  if (insertError) throw insertError

  return created
}

export async function getUserProfile(supabase: SupabaseClient, user: User) {
  const ensured = await ensureUserProfile(supabase, user)

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single<UserProfileRecord>()

  if (error) throw error

  return data || ensured
}
