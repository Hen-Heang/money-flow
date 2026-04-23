import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Category } from '@/lib/types'

// Module-level cache — shared across all hook instances in the same session.
// Prevents duplicate category fetches when multiple components mount.
let cachedCategories: Category[] | null = null
let pendingFetch: Promise<Category[]> | null = null

async function fetchCategories(): Promise<Category[]> {
  if (cachedCategories !== null) return cachedCategories
  if (!pendingFetch) {
    const supabase = createClient()
    pendingFetch = supabase
      .from('categories')
      .select('*')
      .then(({ data }) => {
        const result = (data as Category[]) ?? []
        cachedCategories = result
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

export function invalidateCategoriesCache() {
  cachedCategories = null
}

export function useCategories(): { categories: Category[]; loading: boolean } {
  const [categories, setCategories] = useState<Category[]>(cachedCategories ?? [])
  const [loading, setLoading] = useState(cachedCategories === null)

  useEffect(() => {
    if (cachedCategories !== null) return
    fetchCategories().then(data => {
      setCategories(data)
      setLoading(false)
    })
  }, [])

  return { categories, loading }
}
