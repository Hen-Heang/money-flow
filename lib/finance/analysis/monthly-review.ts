// Month-over-month category comparison used by the monthly review screen
// (Feature 9). Pure functions over already-computed category breakdowns.

import { money, roundKRW, pct } from './money'
import type { CategoryBreakdownEntry } from './types'

export interface CategoryComparisonEntry {
  categoryId: string | null
  categoryName: string
  currentKrw: number
  previousKrw: number
  deltaKrw: number
  deltaPct: number | null
  direction: 'up' | 'down' | 'flat' | 'new' | 'stopped'
}

// Includes categories present in either month, so a category that stopped
// (or started) is still visible rather than silently dropping out.
export function computeCategoryComparison(
  current: CategoryBreakdownEntry[],
  previous: CategoryBreakdownEntry[]
): CategoryComparisonEntry[] {
  const keyFor = (entry: CategoryBreakdownEntry) => entry.category_id ?? `name:${entry.category_name}`

  const previousByKey = new Map(previous.map((entry) => [keyFor(entry), entry]))
  const currentByKey = new Map(current.map((entry) => [keyFor(entry), entry]))
  const allKeys = new Set([...currentByKey.keys(), ...previousByKey.keys()])

  const result: CategoryComparisonEntry[] = []

  for (const key of allKeys) {
    const currentEntry = currentByKey.get(key)
    const previousEntry = previousByKey.get(key)

    const currentKrw = currentEntry?.totalKrw ?? 0
    const previousKrw = previousEntry?.totalKrw ?? 0
    const delta = roundKRW(money(currentKrw).minus(previousKrw))

    let direction: CategoryComparisonEntry['direction']
    if (previousKrw === 0 && currentKrw > 0) direction = 'new'
    else if (currentKrw === 0 && previousKrw > 0) direction = 'stopped'
    else if (delta > 0) direction = 'up'
    else if (delta < 0) direction = 'down'
    else direction = 'flat'

    result.push({
      categoryId: currentEntry?.category_id ?? previousEntry?.category_id ?? null,
      categoryName: currentEntry?.category_name ?? previousEntry?.category_name ?? 'Uncategorized',
      currentKrw,
      previousKrw,
      deltaKrw: delta,
      deltaPct: previousKrw === 0 ? null : pct(delta, previousKrw),
      direction,
    })
  }

  return result.sort((a, b) => b.currentKrw - a.currentKrw)
}

// The category that fell the most — the win worth celebrating. Requires a
// real prior baseline so a category that simply didn't exist last month
// can't masquerade as an improvement.
export function findBestImprovement(comparison: CategoryComparisonEntry[]): CategoryComparisonEntry | null {
  const improved = comparison.filter((entry) => entry.deltaKrw < 0 && entry.previousKrw > 0)
  if (improved.length === 0) return null
  return improved.reduce((best, entry) => (entry.deltaKrw < best.deltaKrw ? entry : best))
}

// The category that grew the most — framed in the UI as "worth a look",
// never as a failure.
export function findBiggestIncrease(comparison: CategoryComparisonEntry[]): CategoryComparisonEntry | null {
  const increased = comparison.filter((entry) => entry.deltaKrw > 0 && entry.previousKrw > 0)
  if (increased.length === 0) return null
  return increased.reduce((worst, entry) => (entry.deltaKrw > worst.deltaKrw ? entry : worst))
}
