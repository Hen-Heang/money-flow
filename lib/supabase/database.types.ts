/**
 * Hand-maintained interim types — NOT generated from the live schema, and
 * covers only a subset of tables (users, transactions, categories,
 * payment_methods, exchange_rates). Many tables that exist in
 * `supabase/migrations/` (budgets, savings_goals, recurring_transactions,
 * ai_financial_insights, telegram_accounts, transaction_templates, etc.) are
 * not represented here, so this file is not wired into any Supabase client's
 * generic today — do not treat it as exhaustive.
 *
 * Regenerate authoritative types once the project is linked/authenticated:
 *
 *   npx supabase login
 *   npx supabase link --project-ref <your-project-ref>
 *   npx supabase gen types --linked --schema public > lib/supabase/database.types.ts
 *
 * (or `npx supabase gen types --project-id <ref> --schema public > ...` without
 * linking). After regenerating, parameterize the clients in
 * lib/supabase/{client,server,admin}.ts with `SupabaseClient<Database>`.
 */
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
