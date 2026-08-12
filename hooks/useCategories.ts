import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'

export const categoriesQueryKey = ['categories'] as const

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data } = await supabase.from('categories').select('*')
  return data ?? []
}

export function useCategories(): { categories: Category[]; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: fetchCategories,
  })

  return { categories: data ?? [], loading: isLoading }
}
