export interface Template {
  id: string
  type: 'income' | 'expense'
  description: string
  amount_krw: number
  currency: string
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  categories?: { icon: string } | null
}

export interface EditTransaction {
  id: string
  type: 'income' | 'expense'
  currency?: string
  amount_krw: number
  amount_usd: number
  date: string
  description: string
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  exchange_rate?: number
}
