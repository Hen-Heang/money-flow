import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Budget } from '@/lib/types'

// Module-level cache — invalidated on upsert via invalidateBudgetsCache()
let cachedBudgets: Budget[] | null = null
let pendingFetch: Promise<Budget[]> | null = null

async function fetchBudgets(): Promise<Budget[]> {
  if (cachedBudgets !== null) return cachedBudgets
  if (!pendingFetch) {
    const supabase = createClient()
    pendingFetch = supabase
      .from('budgets')
      .select('category_id, amount_krw')
      .then(({ data }) => {
        const result = (data as Budget[]) ?? []
        cachedBudgets = result
        pendingFetch = null
        return result
      })
      .catch(() => {
        pendingFetch = null
        return []
      })
  }
  return pendingFetch
}

export function invalidateBudgetsCache() {
  cachedBudgets = null
}

export function useBudgets(): { budgets: Budget[]; loading: boolean } {
  const [budgets, setBudgets] = useState<Budget[]>(cachedBudgets ?? [])
  const [loading, setLoading] = useState(cachedBudgets === null)

  useEffect(() => {
    if (cachedBudgets !== null) return
    fetchBudgets().then(data => {
      setBudgets(data)
      setLoading(false)
    })
  }, [])

  return { budgets, loading }
}
