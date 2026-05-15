// Shared domain types — import from here instead of redefining per-file

export interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  description: string
  amount_krw: number
  amount_usd: number
  currency?: string
  exchange_rate?: number
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  categories?: { name: string; icon: string; color: string } | null
  payment_methods?: { name: string; icon: string } | null
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'income' | 'expense' | 'both'
}

export interface PaymentMethod {
  id: string
  name: string
  icon: string
}

export interface Budget {
  category_id: string
  amount_krw: number
  categories?: { name: string; icon: string; color: string } | null
}

export interface ExchangeRateInfo {
  rate: number
  base_currency: string
  target_currency: string
  fetched_at: string
  cached?: boolean
  fallback?: boolean
  error?: boolean
}
