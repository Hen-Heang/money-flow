import { describe, it, expect } from 'vitest'
import { tx } from './fixtures'
import {
  suggestAliasGroups,
  applyAliasesToTransactions,
  resolveDescription,
  buildAliasMap,
} from '../aliases'
import { computeTopDescriptions } from '../summary'
import { detectSubscriptionCandidates } from '../subscriptions'

describe('suggestAliasGroups — exact tier', () => {
  it('suggests grouping spellings that differ only by case or spacing', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Claude ', amount_krw: 27_000, date: '2026-05-01' }),
      tx({ description: 'claude', amount_krw: 27_000, date: '2026-06-01' }),
      tx({ description: 'CLAUDE', amount_krw: 27_000, date: '2026-07-01' }),
    ])

    const exact = suggestions.find((s) => s.confidence === 'exact')
    expect(exact).toBeDefined()
    expect(exact!.members).toHaveLength(1)
    expect(exact!.occurrenceCount).toBe(3)
    expect(exact!.totalKrw).toBe(81_000)
    // Variants are shown trimmed — surrounding whitespace is invisible in the
    // UI and would read as a duplicate of itself.
    expect(exact!.members[0].variants.sort()).toEqual(['CLAUDE', 'Claude', 'claude'].sort())
  })

  it('does not ask about a difference that is only surrounding whitespace', () => {
    // Normalization already groups these identically, so there is nothing
    // for the user to decide.
    const suggestions = suggestAliasGroups([
      tx({ description: 'Netflix', date: '2026-05-01' }),
      tx({ description: 'Netflix ', date: '2026-06-01' }),
      tx({ description: '  Netflix', date: '2026-07-01' }),
    ])
    expect(suggestions).toEqual([])
  })

  it('suggests the most frequently used spelling as the canonical name', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Coupang', date: '2026-05-01' }),
      tx({ description: 'Coupang', date: '2026-05-02' }),
      tx({ description: 'coupang ', date: '2026-05-03' }),
    ])

    expect(suggestions[0].suggestedCanonical).toBe('Coupang')
  })

  it('does not suggest anything when every description is already consistent', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Rent', date: '2026-05-01' }),
      tx({ description: 'Rent', date: '2026-06-01' }),
    ])
    expect(suggestions).toEqual([])
  })

  it('returns nothing for an empty history', () => {
    expect(suggestAliasGroups([])).toEqual([])
  })
})

describe('suggestAliasGroups — likely tier', () => {
  it('flags near-variants as lower confidence rather than merging them silently', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Claude', date: '2026-05-01' }),
      tx({ description: 'Claude AI', date: '2026-06-01' }),
      tx({ description: 'Claude AI Pro', date: '2026-07-01' }),
    ])

    const likely = suggestions.find((s) => s.confidence === 'likely')
    expect(likely).toBeDefined()
    expect(likely!.members.length).toBeGreaterThan(1)
  })

  it('ignores a one-off pairing that is not worth asking about', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Claude', date: '2026-05-01' }),
      tx({ description: 'Claude AI', date: '2026-06-01' }),
    ])
    // Only 2 occurrences — below the threshold for a fuzzy prompt.
    expect(suggestions.filter((s) => s.confidence === 'likely')).toEqual([])
  })

  it('does not group unrelated merchants', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Grocery store', date: '2026-05-01' }),
      tx({ description: 'Petrol station', date: '2026-06-01' }),
      tx({ description: 'Cinema ticket', date: '2026-07-01' }),
    ])
    expect(suggestions).toEqual([])
  })

  it('ranks exact suggestions above likely ones', () => {
    const suggestions = suggestAliasGroups([
      tx({ description: 'Netflix', date: '2026-05-01' }),
      tx({ description: 'netflix', date: '2026-05-02' }),
      tx({ description: 'Claude', date: '2026-05-03' }),
      tx({ description: 'Claude AI', date: '2026-06-01' }),
      tx({ description: 'Claude AI Pro', date: '2026-07-01' }),
    ])
    expect(suggestions[0].confidence).toBe('exact')
    expect(suggestions.some((s) => s.confidence === 'likely')).toBe(true)
  })
})

describe('suggestAliasGroups — respects confirmed aliases', () => {
  it('stops suggesting a group the user has already resolved', () => {
    const transactions = [
      tx({ description: 'Claude ', date: '2026-05-01' }),
      tx({ description: 'claude', date: '2026-06-01' }),
    ]

    expect(suggestAliasGroups(transactions)).toHaveLength(1)
    expect(
      suggestAliasGroups(transactions, [{ normalizedKey: 'claude', canonicalDescription: 'Claude' }])
    ).toEqual([])
  })
})

describe('applyAliasesToTransactions', () => {
  const aliases = [
    { normalizedKey: 'claude', canonicalDescription: 'Claude AI Pro' },
    { normalizedKey: 'claude ai', canonicalDescription: 'Claude AI Pro' },
  ]

  it('rewrites descriptions to the confirmed canonical name', () => {
    const result = applyAliasesToTransactions(
      [tx({ description: 'claude ' }), tx({ description: 'Claude AI' }), tx({ description: 'Rent' })],
      aliases
    )

    expect(result[0].description).toBe('Claude AI Pro')
    expect(result[1].description).toBe('Claude AI Pro')
    expect(result[2].description).toBe('Rent')
  })

  it('returns the original array untouched when there are no aliases', () => {
    const transactions = [tx({ description: 'Claude' })]
    expect(applyAliasesToTransactions(transactions, [])).toBe(transactions)
  })

  it('does not mutate the input transactions', () => {
    const transactions = [tx({ description: 'claude ' })]
    applyAliasesToTransactions(transactions, aliases)
    expect(transactions[0].description).toBe('claude ')
  })

  it('folds variants into a single row in top descriptions', () => {
    const raw = [
      tx({ description: 'Claude ', amount_krw: 27_000, date: '2026-07-01' }),
      tx({ description: 'claude', amount_krw: 27_000, date: '2026-07-02' }),
      tx({ description: 'Claude AI', amount_krw: 27_000, date: '2026-07-03' }),
    ]

    // Without aliases "claude" and "claude ai" are separate rows.
    expect(computeTopDescriptions(raw)).toHaveLength(2)

    const resolved = applyAliasesToTransactions(raw, aliases)
    const top = computeTopDescriptions(resolved)
    expect(top).toHaveLength(1)
    expect(top[0].totalKrw).toBe(81_000)
  })

  it('lets confirmed merges tighten subscription detection', () => {
    const raw = [
      tx({ description: 'Claude', amount_krw: 27_000, date: '2026-05-02' }),
      tx({ description: 'Claude AI', amount_krw: 27_000, date: '2026-06-02' }),
      tx({ description: 'claude ', amount_krw: 27_000, date: '2026-07-02' }),
    ]

    const resolved = applyAliasesToTransactions(raw, aliases)
    const candidates = detectSubscriptionCandidates(resolved)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].name).toBe('Claude AI Pro')
    expect(candidates[0].variantDescriptions).toEqual(['Claude AI Pro'])
  })
})

describe('resolveDescription', () => {
  const map = buildAliasMap([{ normalizedKey: 'claude', canonicalDescription: 'Claude AI Pro' }])

  it('resolves a known variant regardless of spacing or case', () => {
    expect(resolveDescription('  CLAUDE ', map)).toBe('Claude AI Pro')
  })

  it('leaves an unknown description alone', () => {
    expect(resolveDescription('Rent', map)).toBe('Rent')
  })
})
