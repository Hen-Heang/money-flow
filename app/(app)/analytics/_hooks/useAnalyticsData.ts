'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { useTransactionsChanged } from '@/hooks/useTransactionSync'
import type { Transaction } from '@/lib/types'
import type { AnalyticsBudget } from '../_types'

const analyticsQueryKey = ['transactions', 'analytics'] as const

export function useAnalyticsData() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return { transactions: [], budgets: [] }

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

      return {
        transactions: (txData as Transaction[]) || [],
        budgets: (budgetData as AnalyticsBudget[]) || [],
      }
    },
  })

  useTransactionsChanged(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: analyticsQueryKey })
  }, [queryClient]))

  return {
    transactions: data?.transactions ?? [],
    budgets: data?.budgets ?? [],
    loading: isLoading,
  }
}
