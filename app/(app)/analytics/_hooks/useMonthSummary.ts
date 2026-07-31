'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { monthKey, getMonthRange } from '@/lib/dateHelpers'
import type { MonthSummary, View } from '../_types'

export function useMonthSummary(view: View, year: number, month: number, prevYear: number, prevMonth: number) {
  const supabase = useSupabaseClient()
  const monthCacheRef = useRef(new Map<string, MonthSummary>()).current
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null)
  const [prevMonthSummary, setPrevMonthSummary] = useState<MonthSummary | null>(null)
  const [monthLoading, setMonthLoading] = useState(false)

  const fetchMonthSummary = useCallback(async (y: number, m: number, userId: string): Promise<MonthSummary | null> => {
    const key = monthKey(y, m)
    if (monthCacheRef.has(key)) return monthCacheRef.get(key)!
    const { start, end } = getMonthRange(y, m)
    const { data } = await supabase
      .from('transactions')
      .select('type, amount_krw, categories(name, icon, color)')
      .eq('user_id', userId)
      .gte('date', start)
      .lt('date', end)
    if (!data) return null
    const rows = data as { type: string; amount_krw: number; categories: { name: string; icon: string; color: string } | null }[]
    const income = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const expense = rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
    const catMap: Record<string, { name: string; icon: string; color: string; total: number }> = {}
    rows.filter(t => t.type === 'expense' && t.categories).forEach(t => {
      const c = t.categories!
      if (!catMap[c.name]) catMap[c.name] = { ...c, total: 0 }
      catMap[c.name].total += t.amount_krw
    })
    const result: MonthSummary = {
      income, expense, txCount: rows.length,
      topCategories: Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 6),
    }
    monthCacheRef.set(key, result)
    return result
  }, [supabase, monthCacheRef])

  useEffect(() => {
    if (view !== 'monthly') return
    // Flip the skeleton on synchronously when switching views/months — deferring
    // this would show stale data for a frame before the fetch below starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonthLoading(true)
    let cancelled = false
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId || cancelled) return
      const [cur, prev] = await Promise.all([
        fetchMonthSummary(year, month, userId),
        fetchMonthSummary(prevYear, prevMonth, userId),
      ])
      if (cancelled) return
      setMonthSummary(cur)
      setPrevMonthSummary(prev)
      setMonthLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [view, year, month, prevYear, prevMonth, fetchMonthSummary, supabase])

  return { monthSummary, prevMonthSummary, monthLoading }
}
