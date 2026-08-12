import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getQueryClient } from '@/lib/queryClient'
import type { Budget } from '@/lib/types'

export const budgetsQueryKey = ['budgets'] as const

async function fetchBudgets(): Promise<Budget[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('budgets')
    .select('category_id, amount_krw, categories(name, icon, color)')
  return data ?? []
}

export function invalidateBudgetsCache() {
  getQueryClient()?.invalidateQueries({ queryKey: budgetsQueryKey })
}

export function useBudgets(): { budgets: Budget[]; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: budgetsQueryKey,
    queryFn: fetchBudgets,
  })

  return { budgets: data ?? [], loading: isLoading }
}
