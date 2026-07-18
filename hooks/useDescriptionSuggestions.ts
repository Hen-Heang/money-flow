'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'

export interface DescriptionSuggestion {
  description: string
  categoryId: string | null
  paymentMethodId: string | null
  count: number
}

interface HistoryRow {
  description: string
  type: 'income' | 'expense'
  category_id: string | null
  payment_method_id: string | null
}

interface HistoryEntry {
  description: string
  type: 'income' | 'expense'
  count: number
  categoryCounts: Record<string, number>
  methodCounts: Record<string, number>
}

function mostFrequent(counts: Record<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [key, count] of Object.entries(counts)) {
    if (count > bestCount) { best = key; bestCount = count }
  }
  return best
}

export function useDescriptionSuggestions(enabled: boolean, type: 'income' | 'expense', query: string) {
  const supabase = useSupabaseClient()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('description, type, category_id, payment_method_id')
        .order('date', { ascending: false })
        .limit(300)
      if (cancelled) return
      if (!data) {
        setHasLoaded(true)
        return
      }

      const map = new Map<string, HistoryEntry>()
      for (const row of data as HistoryRow[]) {
        const description = row.description?.trim()
        if (!description) continue
        const key = `${row.type}:${description.toLowerCase()}`
        let entry = map.get(key)
        if (!entry) {
          entry = { description, type: row.type, count: 0, categoryCounts: {}, methodCounts: {} }
          map.set(key, entry)
        }
        entry.count++
        if (row.category_id) entry.categoryCounts[row.category_id] = (entry.categoryCounts[row.category_id] || 0) + 1
        if (row.payment_method_id) entry.methodCounts[row.payment_method_id] = (entry.methodCounts[row.payment_method_id] || 0) + 1
      }
      setHistory(Array.from(map.values()))
      setHasLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [enabled, supabase])

  return useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { suggestions: [] as DescriptionSuggestion[], exactMatch: null, isReady: enabled && hasLoaded }
    const toSuggestion = (entry: HistoryEntry): DescriptionSuggestion => ({
      description: entry.description,
      categoryId: mostFrequent(entry.categoryCounts),
      paymentMethodId: mostFrequent(entry.methodCounts),
      count: entry.count,
    })
    const exact = history.find(entry => entry.type === type && entry.description.toLowerCase() === q)
    const matches = history.filter(e =>
      e.type === type &&
      e.description.toLowerCase() !== q &&
      e.description.toLowerCase().includes(q)
    )
    matches.sort((a, b) => {
      const aStarts = a.description.toLowerCase().startsWith(q) ? 1 : 0
      const bStarts = b.description.toLowerCase().startsWith(q) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts
      return b.count - a.count
    })
    return {
      suggestions: matches.slice(0, 5).map(toSuggestion),
      exactMatch: exact ? toSuggestion(exact) : null,
      isReady: enabled && hasLoaded,
    }
  }, [history, type, query, enabled, hasLoaded])
}
