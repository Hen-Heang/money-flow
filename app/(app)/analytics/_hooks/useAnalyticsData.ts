'use client'

import { useState, useCallback, useEffect } from 'react'
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { useTransactionsChanged } from '@/hooks/useTransactionSync'
import type { Transaction } from '@/lib/types'
import type { AnalyticsBudget } from '../_types'

export function useAnalyticsData() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<AnalyticsBudget[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useSupabaseClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5))
      const now = endOfMonth(new Date())

      const [{ data: txData }, { data: budgetData }] = await Promise.all([
        supabase
          .from('transactions')
          .select('date, type, amount_krw, category_id, categories(name, icon, color), payment_methods(name, icon)')
          .eq('user_id', user.id)
          .gte('date', format(sixMonthsAgo, 'yyyy-MM-dd'))
          .lte('date', format(now, 'yyyy-MM-dd'))
          .order('date', { ascending: true }),
        supabase
          .from('budgets')
          .select('category_id, amount_krw, categories(name, icon, color)')
          .eq('user_id', user.id)
          .gt('amount_krw', 0),
      ])

      setTransactions((txData as Transaction[]) || [])
      setBudgets((budgetData as AnalyticsBudget[]) || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  useTransactionsChanged(loadData)

  return { transactions, budgets, loading }
}
