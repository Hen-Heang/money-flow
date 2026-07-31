export interface UserProfile {
  display_name: string | null
  default_currency: string
  email: string
  avatar_url: string | null
}

export type SettingsSection = 'ai' | 'categories' | 'payment' | 'telegram' | 'budgets' | 'tips'
