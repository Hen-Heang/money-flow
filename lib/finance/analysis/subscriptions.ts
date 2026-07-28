// Subscription detection (Feature 3). Pure, deterministic clustering over
// already-loaded transactions — no AI involved. Output is always a
// *candidate* for the user to review; nothing here cancels or changes data.

import { money, sumMoney, roundKRW } from './money'
import { similarityScore } from './normalize'
import type { EngineTransaction } from './types'

export type SubscriptionFrequency = 'monthly' | 'yearly' | 'irregular'
export type SubscriptionConfidence = 'high' | 'medium' | 'low'

export interface SubscriptionCandidate {
  key: string
  name: string
  variantDescriptions: string[]
  latestAmountKrw: number
  averageAmountKrw: number
  frequency: SubscriptionFrequency
  lastPaymentDate: string
  estimatedYearlyCostKrw: number
  confidence: SubscriptionConfidence
  occurrenceCount: number
  categoryName: string | null
  averageIntervalDays: number | null
  matchedRecurringTemplate: boolean
}

export interface RecurringTemplateHint {
  description: string
  amount_krw: number
  category_name: string | null
}

const SIMILARITY_THRESHOLD = 0.5
const AMOUNT_TOLERANCE_PCT = 0.15

function amountsAreSimilar(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true
  const diff = Math.abs(a - b)
  const base = Math.max(a, b)
  return base === 0 ? true : diff / base <= AMOUNT_TOLERANCE_PCT
}

// Single-linkage clustering: a transaction joins a cluster if it's similar
// to ANY existing member (not just the first). This lets chains like
// "Claude" -> "Claude AI" -> "Claude AI Pro" cluster together even though
// the two ends aren't directly similar enough on their own.
function clusterTransactions(transactions: EngineTransaction[]): EngineTransaction[][] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  const clusters: EngineTransaction[][] = []

  for (const t of sorted) {
    const cluster = clusters.find((c) =>
      c.some((member) => similarityScore(member.description, t.description) >= SIMILARITY_THRESHOLD && amountsAreSimilar(member.amount_krw, t.amount_krw))
    )
    if (cluster) cluster.push(t)
    else clusters.push([t])
  }

  return clusters
}

function computeIntervals(dates: string[]): number[] {
  if (dates.length < 2) return []
  const sorted = [...dates].sort()
  const ms = sorted.map((d) => new Date(`${d}T00:00:00Z`).getTime())
  const intervals: number[] = []
  for (let i = 1; i < ms.length; i++) intervals.push((ms[i] - ms[i - 1]) / 86_400_000)
  return intervals
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

// Requires EVERY interval (not just the average) to look monthly/yearly —
// an average can land in range by coincidence even when the actual cadence
// is erratic (e.g. Coupang deliveries 19 and 36 days apart average to ~27.5,
// which looks monthly but isn't a real subscription cadence).
function frequencyFromIntervals(intervals: number[]): SubscriptionFrequency {
  if (intervals.length === 0) return 'irregular'
  if (intervals.every((d) => d >= 25 && d <= 35)) return 'monthly'
  if (intervals.every((d) => d >= 350 && d <= 380)) return 'yearly'
  return 'irregular'
}

function estimateYearlyCost(frequency: SubscriptionFrequency, averageAmountKrw: number, avgIntervalDays: number | null): number {
  if (frequency === 'monthly') return roundKRW(money(averageAmountKrw).times(12))
  if (frequency === 'yearly') return roundKRW(averageAmountKrw)
  if (avgIntervalDays && avgIntervalDays > 0) {
    return roundKRW(money(averageAmountKrw).times(365 / avgIntervalDays))
  }
  return roundKRW(averageAmountKrw)
}

function confidenceFor(occurrenceCount: number, frequency: SubscriptionFrequency, matchedRecurringTemplate: boolean): SubscriptionConfidence {
  if (matchedRecurringTemplate) return 'high'
  if (occurrenceCount >= 3 && frequency !== 'irregular') return 'high'
  if (occurrenceCount === 2 && frequency !== 'irregular') return 'medium'
  if (occurrenceCount >= 3 && frequency === 'irregular') return 'medium'
  return 'low'
}

export function detectSubscriptionCandidates(
  transactions: EngineTransaction[],
  recurringTemplates: RecurringTemplateHint[] = []
): SubscriptionCandidate[] {
  const expenses = transactions.filter((t) => t.type === 'expense')
  const clusters = clusterTransactions(expenses).filter((c) => c.length >= 2)

  return clusters
    .map((cluster): SubscriptionCandidate => {
      const dates = cluster.map((t) => t.date)
      const intervals = computeIntervals(dates)
      const avgInterval = averageOf(intervals)
      const frequency = frequencyFromIntervals(intervals)
      const sortedByDate = [...cluster].sort((a, b) => a.date.localeCompare(b.date))
      const latest = sortedByDate[sortedByDate.length - 1]
      const averageAmount = roundKRW(sumMoney(cluster.map((t) => t.amount_krw)).dividedBy(cluster.length))
      const variantDescriptions = Array.from(new Set(cluster.map((t) => t.description)))

      const matchedRecurringTemplate = recurringTemplates.some(
        (r) => similarityScore(r.description, latest.description) >= SIMILARITY_THRESHOLD && amountsAreSimilar(r.amount_krw, latest.amount_krw)
      )

      return {
        key: `${latest.category_id ?? 'none'}:${variantDescriptions[0].toLowerCase().trim()}`,
        name: latest.description,
        variantDescriptions,
        latestAmountKrw: latest.amount_krw,
        averageAmountKrw: averageAmount,
        frequency,
        lastPaymentDate: latest.date,
        estimatedYearlyCostKrw: estimateYearlyCost(frequency, averageAmount, avgInterval),
        confidence: confidenceFor(cluster.length, frequency, matchedRecurringTemplate),
        occurrenceCount: cluster.length,
        categoryName: latest.category_name,
        averageIntervalDays: avgInterval === null ? null : Math.round(avgInterval),
        matchedRecurringTemplate,
      }
    })
    // Only real candidates: recurring cadence, or 3+ repeats of the same
    // merchant even without a clean interval (e.g. irregular delivery apps).
    .filter((c) => c.frequency !== 'irregular' || c.occurrenceCount >= 3)
    .sort((a, b) => b.estimatedYearlyCostKrw - a.estimatedYearlyCostKrw)
}
