// Description normalization utilities (Feature 2).
//
// Two distinct strictness levels are intentional:
//  - `normalizeDescription` / `groupExactAliasCandidates`: exact-match after
//    trim/casefold/whitespace-collapse only. Used to suggest aliases for
//    obvious duplicates ("Claude ", "claude", "CLAUDE") — safe enough to
//    surface with high confidence, but still never applied without the user
//    confirming (the DB alias table is the only thing that changes; raw
//    transaction rows are never edited).
//  - `similarityScore` / clustering in subscriptions.ts: fuzzy token overlap,
//    used only for *candidate suggestions* (e.g. "Claude" vs "Claude AI Pro"
//    look like the same merchant) — never for merging financial totals.

export function normalizeDescription(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
}

export function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean)
}

// Jaccard similarity over word tokens. 0 = no overlap, 1 = identical token sets.
export function similarityScore(a: string, b: string): number {
  const tokensA = new Set(tokenize(normalizeDescription(a)))
  const tokensB = new Set(tokenize(normalizeDescription(b)))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const t of tokensA) if (tokensB.has(t)) intersection++
  const union = tokensA.size + tokensB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export interface AliasCandidateGroup {
  normalizedDescription: string
  variants: string[] // distinct raw descriptions that normalize to the same value
  occurrenceCount: number
}

// Groups raw descriptions that are byte-different but normalize identically
// (whitespace/case only). These are the only "obvious" merges — still
// presented to the user for confirmation, never auto-applied.
export function groupExactAliasCandidates(descriptions: string[]): AliasCandidateGroup[] {
  const groups = new Map<string, { variants: Set<string>; count: number }>()

  for (const raw of descriptions) {
    const normalized = normalizeDescription(raw)
    if (!normalized) continue
    const existing = groups.get(normalized) ?? { variants: new Set<string>(), count: 0 }
    existing.variants.add(raw)
    existing.count += 1
    groups.set(normalized, existing)
  }

  return Array.from(groups.entries())
    .filter(([, g]) => g.variants.size > 1)
    .map(([normalizedDescription, g]) => ({
      normalizedDescription,
      variants: Array.from(g.variants),
      occurrenceCount: g.count,
    }))
}
