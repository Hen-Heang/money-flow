import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Bypass navigator.locks API which causes:
//   AbortError: Lock broken by another request with the 'steal' option
// in Safari / iOS WebKit when multiple tabs are open.
const noopLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

const clientOptions = {
  auth: { lock: noopLock },
}

// Singleton — one client per environment, created once on first call
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export const createClient = () => {
  if (typeof window === 'undefined') {
    return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions)
  }

  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions)
  }

  return browserClient
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          default_currency: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          default_currency?: string
          created_at?: string
        }
        Update: {
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          default_currency?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          date: string
          type: 'income' | 'expense'
          category_id: string | null
          description: string
          amount_krw: number
          amount_usd: number
          exchange_rate: number
          payment_method_id: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          date: string
          type: 'income' | 'expense'
          category_id?: string | null
          description: string
          amount_krw: number
          amount_usd: number
          exchange_rate: number
          payment_method_id?: string | null
          note?: string | null
        }
        Update: Partial<{
          date: string
          type: 'income' | 'expense'
          category_id: string | null
          description: string
          amount_krw: number
          amount_usd: number
          exchange_rate: number
          payment_method_id: string | null
          note: string | null
        }>
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          type: 'income' | 'expense' | 'both'
          created_at: string
        }
        Insert: {
          user_id: string
          name: string
          icon: string
          color: string
          type: 'income' | 'expense' | 'both'
        }
        Update: Partial<{
          name: string
          icon: string
          color: string
          type: string
        }>
      }
      payment_methods: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          created_at: string
        }
        Insert: {
          user_id: string
          name: string
          icon: string
        }
        Update: Partial<{
          name: string
          icon: string
        }>
      }
      exchange_rates: {
        Row: {
          id: string
          base_currency: string
          target_currency: string
          rate: number
          fetched_at: string
        }
      }
    }
  }
}
