// Unusual-transaction and possible-duplicate detection. Heuristic, always
// deterministic (same input -> same output), and always presented as a
// "worth reviewing" suggestion — never auto-flags anything as an error.

import { normalizeDescription } from './normalize'
import { median, medianAbsoluteDeviation } from './stats'
import type { EngineTransaction } from './types'

export interface UnusualTransaction {
  transactionId: string
  description: string
  amountKrw: number
  date: string
  categoryName: string | null
  reason: string
  severity: 'moderate' | 'high'
}

const MIN_SAMPLE_SIZE = 5
const MAD_HIGH_THRESHOLD = 5
const MAD_MODERATE_THRESHOLD = 3.5

// Flags expense transactions that are statistical outliers relative to the
// user's own recent spending (overall, or within the same category when
// there's enough category history to be meaningful).
export function detectUnusualTransactions(transactions: EngineTransaction[]): UnusualTransaction[] {
  const expenses = transactions.filter((t) => t.type === 'expense')
  if (expenses.length < MIN_SAMPLE_SIZE) return []

  const byCategory = new Map<string, EngineTransaction[]>()
  for (const t of expenses) {
    const key = t.category_id ?? '__uncategorized__'
    const list = byCategory.get(key) ?? []
    list.push(t)
    byCategory.set(key, list)
  }

  const results: UnusualTransaction[] = []

  for (const [, group] of byCategory) {
    const pool = group.length >= MIN_SAMPLE_SIZE ? group : expenses
    const amounts = pool.map((t) => t.amount_krw)
    const med = median(amounts)
    const mad = medianAbsoluteDeviation(amounts, med)
    // 0.6745 is the constant that makes MAD comparable to a standard deviation
    // for normally-distributed data.
    const scaledMad = mad === 0 ? 1 : mad * 1.4826

    for (const t of group) {
      const score = Math.abs(t.amount_krw - med) / scaledMad
      if (t.amount_krw <= med || score < MAD_MODERATE_THRESHOLD) continue

      results.push({
        transactionId: t.id,
        description: t.description,
        amountKrw: t.amount_krw,
        date: t.date,
        categoryName: t.category_name,
        reason: `${t.amount_krw.toLocaleString()} KRW is well above the typical ${Math.round(med).toLocaleString()} KRW for ${t.category_name ?? 'this category'}.`,
        severity: score >= MAD_HIGH_THRESHOLD ? 'high' : 'moderate',
      })
    }
  }

  return results.sort((a, b) => b.amountKrw - a.amountKrw)
}

export interface PossibleDuplicateTransaction {
  transactionIds: [string, string]
  description: string
  amountKrw: number
  date: string
  reason: string
}

// Same normalized description + same amount + same (or adjacent) day is the
// classic double-entry pattern — e.g. a bulk "lunch coupon" purchase plus an
// individual "lunch" transaction that both represent the same spend.
export function detectPossibleDuplicateTransactions(transactions: EngineTransaction[]): PossibleDuplicateTransaction[] {
  const expenses = [...transactions.filter((t) => t.type === 'expense')].sort((a, b) => a.date.localeCompare(b.date))
  const results: PossibleDuplicateTransaction[] = []

  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i]
      const b = expenses[j]
      const dayDiff = Math.abs(new Date(b.date).getTime() - new Date(a.date).getTime()) / 86_400_000
      if (dayDiff > 1) break // sorted by date — nothing further can be within range

      if (a.id === b.id) continue
      if (a.amount_krw !== b.amount_krw) continue
      if (normalizeDescription(a.description) !== normalizeDescription(b.description)) continue

      results.push({
        transactionIds: [a.id, b.id],
        description: a.description,
        amountKrw: a.amount_krw,
        date: a.date,
        reason: `Two "${a.description}" transactions of the same amount were logged within a day of each other — check they aren't double-counting the same spend.`,
      })
    }
  }

  return results
}
