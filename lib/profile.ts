import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Salary',       icon: '💼', color: '#10b981', type: 'income' },
  { name: 'Freelance',    icon: '💻', color: '#3b82f6', type: 'income' },
  { name: 'Investment',   icon: '📈', color: '#f59e0b', type: 'income' },
  { name: 'Other Income', icon: '💰', color: '#8b5cf6', type: 'income' },
  // Expense
  { name: 'Food & Dining',  icon: '🍔', color: '#ef4444', type: 'expense' },
  { name: 'Transport',      icon: '🚗', color: '#f59e0b', type: 'expense' },
  { name: 'Shopping',       icon: '🛍️', color: '#ec4899', type: 'expense' },
  { name: 'Entertainment',  icon: '🎮', color: '#8b5cf6', type: 'expense' },
  { name: 'Health',         icon: '💊', color: '#06b6d4', type: 'expense' },
  { name: 'Housing',        icon: '🏠', color: '#3b82f6', type: 'expense' },
  { name: 'Education',      icon: '📚', color: '#10b981', type: 'expense' },
  { name: 'Other',          icon: '📦', color: '#94a3b8', type: 'expense' },
]

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Cash',          icon: '💵' },
  { name: 'Credit Card',   icon: '💳' },
  { name: 'Debit Card',    icon: '🏦' },
  { name: 'Bank Transfer', icon: '🏧' },
]

async function seedDefaultUserData(supabase: SupabaseClient, userId: string) {
  await Promise.all([
    supabase.from('categories').insert(
      DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: userId }))
    ),
    supabase.from('payment_methods').insert(
      DEFAULT_PAYMENT_METHODS.map(m => ({ ...m, user_id: userId }))
    ),
  ])
}

export interface UserProfileRecord {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  default_currency: string
  created_at?: string
}

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { data: existingData, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const existing = existingData as UserProfileRecord | null

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

  const meta = user.user_metadata ?? {}
  const profile = {
    id: user.id,
    email: user.email || '',
    display_name:
      typeof meta.full_name === 'string' ? meta.full_name :
      typeof meta.name === 'string' ? meta.name :
      typeof meta.display_name === 'string' ? meta.display_name :
      null,
    avatar_url:
      typeof meta.avatar_url === 'string' ? meta.avatar_url :
      typeof meta.picture === 'string' ? meta.picture :
      null,
    default_currency: 'KRW',
  }

  const { data: createdData, error: insertError } = await supabase
    .from('users')
    .insert(profile)
    .select('*')
    .single()

  const created = createdData as UserProfileRecord | null

  if (insertError) throw insertError

  // Seed default categories and payment methods for new users
  await seedDefaultUserData(supabase, user.id)

  return created
}

export async function getUserProfile(supabase: SupabaseClient, user: User) {
  // ensureUserProfile already returns the full row (existing or newly inserted)
  return ensureUserProfile(supabase, user)
}
