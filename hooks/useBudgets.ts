import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
      .select('category_id, amount_krw, categories(name, icon, color)')
      .then(({ data }: { data: Budget[] | null }) => {
        const result = data ?? []
        cachedBudgets = result
        pendingFetch = null
        return result
      })
      .catch(() => {
        pendingFetch = null
        return []
      })
  }
  // The branch above always assigns pendingFetch when it was null.
  return pendingFetch!
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
