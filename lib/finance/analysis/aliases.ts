// Merchant/description alias suggestions (Feature 2).
//
// Two strictness tiers, and neither one ever edits a transaction:
//  - 'exact'  — raw descriptions that normalize identically ("Claude ",
//               "claude", "CLAUDE"). Safe to suggest confidently.
//  - 'likely' — different normalized keys that look like the same merchant
//               ("claude" vs "claude ai pro"). Suggested far more cautiously
//               because merging them changes what counts toward a total.
//
// Nothing is applied until the user confirms. Confirmation writes an alias
// row; the underlying transaction descriptions are never rewritten.

import Decimal from 'decimal.js'
import { money, roundKRW } from './money'
import { normalizeDescription, similarityScore } from './normalize'
import type { EngineTransaction } from './types'

export type AliasConfidence = 'exact' | 'likely'

export interface AliasMember {
  normalizedKey: string
  sample: string
  variants: string[]
  count: number
  totalKrw: number
}

export interface AliasSuggestion {
  /** Stable across regeneration so a dismissed suggestion stays dismissed. */
  id: string
  suggestedCanonical: string
  members: AliasMember[]
  confidence: AliasConfidence
  occurrenceCount: number
  totalKrw: number
}

export interface StoredAlias {
  normalizedKey: string
  canonicalDescription: string
}

const FUZZY_THRESHOLD = 0.5
// A one-off pairing isn't worth asking about; repeated spend is.
const MIN_FUZZY_OCCURRENCES = 3

interface KeyStats {
  normalizedKey: string
  variants: Map<string, number>
  count: number
  total: Decimal
}

function collectByNormalizedKey(transactions: EngineTransaction[]): Map<string, KeyStats> {
  const byKey = new Map<string, KeyStats>()

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const raw = (t.description ?? '').trim()
    if (!raw) continue

    const key = normalizeDescription(raw)
    if (!key) continue

    const entry = byKey.get(key) ?? { normalizedKey: key, variants: new Map(), count: 0, total: new Decimal(0) }
    entry.variants.set(raw, (entry.variants.get(raw) ?? 0) + 1)
    entry.count += 1
    entry.total = entry.total.plus(money(t.amount_krw))
    byKey.set(key, entry)
  }

  return byKey
}

// The variant the user actually types most often reads best as the canonical
// name; ties break toward the longer (usually more complete) spelling.
function pickCanonical(variants: Map<string, number>): string {
  let best = ''
  let bestCount = -1

  for (const [variant, count] of variants) {
    if (count > bestCount || (count === bestCount && variant.length > best.length)) {
      best = variant
      bestCount = count
    }
  }
  return best.trim()
}

function toMember(stats: KeyStats): AliasMember {
  return {
    normalizedKey: stats.normalizedKey,
    sample: pickCanonical(stats.variants),
    variants: Array.from(stats.variants.keys()),
    count: stats.count,
    totalKrw: roundKRW(stats.total),
  }
}

function suggestionId(keys: string[]): string {
  return [...keys].sort().join('|')
}

export function suggestAliasGroups(
  transactions: EngineTransaction[],
  existingAliases: StoredAlias[] = []
): AliasSuggestion[] {
  const resolved = new Set(existingAliases.map((a) => a.normalizedKey))
  const byKey = collectByNormalizedKey(transactions)
  const suggestions: AliasSuggestion[] = []

  // Tier 1 — same normalized key, different raw spellings.
  for (const stats of byKey.values()) {
    if (resolved.has(stats.normalizedKey)) continue
    if (stats.variants.size < 2) continue

    const member = toMember(stats)
    suggestions.push({
      id: suggestionId([stats.normalizedKey]),
      suggestedCanonical: member.sample,
      members: [member],
      confidence: 'exact',
      occurrenceCount: stats.count,
      totalKrw: member.totalKrw,
    })
  }

  // Tier 2 — distinct keys that look like the same merchant. Single-linkage
  // over keys, mirroring how subscription clustering groups variants.
  const unresolvedKeys = Array.from(byKey.values()).filter((s) => !resolved.has(s.normalizedKey))
  const clusters: KeyStats[][] = []

  for (const stats of unresolvedKeys) {
    const cluster = clusters.find((c) => c.some((member) => similarityScore(member.normalizedKey, stats.normalizedKey) >= FUZZY_THRESHOLD))
    if (cluster) cluster.push(stats)
    else clusters.push([stats])
  }

  for (const cluster of clusters) {
    if (cluster.length < 2) continue

    const occurrenceCount = cluster.reduce((sum, s) => sum + s.count, 0)
    if (occurrenceCount < MIN_FUZZY_OCCURRENCES) continue

    const members = cluster.map(toMember).sort((a, b) => b.count - a.count)
    suggestions.push({
      id: suggestionId(cluster.map((s) => s.normalizedKey)),
      suggestedCanonical: members[0].sample,
      members,
      confidence: 'likely',
      occurrenceCount,
      totalKrw: roundKRW(members.reduce((sum, m) => sum.plus(money(m.totalKrw)), new Decimal(0))),
    })
  }

  // Exact matches first — they're the safe ones to act on.
  return suggestions.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'exact' ? -1 : 1
    return b.totalKrw - a.totalKrw
  })
}

export function buildAliasMap(aliases: StoredAlias[]): Map<string, string> {
  return new Map(aliases.map((a) => [a.normalizedKey, a.canonicalDescription]))
}

export function resolveDescription(description: string, aliasMap: Map<string, string>): string {
  const key = normalizeDescription(description ?? '')
  return aliasMap.get(key) ?? description
}

// Rewrites descriptions to their confirmed canonical form for analysis only.
// The stored transactions are untouched — this operates on the in-memory copy
// the engine works with, so totals and subscription grouping respect the
// user's confirmed merges.
export function applyAliasesToTransactions(
  transactions: EngineTransaction[],
  aliases: StoredAlias[]
): EngineTransaction[] {
  if (aliases.length === 0) return transactions
  const aliasMap = buildAliasMap(aliases)

  return transactions.map((t) => {
    const canonical = resolveDescription(t.description, aliasMap)
    return canonical === t.description ? t : { ...t, description: canonical }
  })
}
