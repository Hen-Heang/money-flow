import { describe, it, expect } from 'vitest'
import { normalizeDescription, similarityScore, groupExactAliasCandidates } from '../normalize'

describe('normalizeDescription', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeDescription('  Claude AI  ')).toBe('claude ai')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeDescription('Claude   AI   Pro')).toBe('claude ai pro')
  })

  it('treats different-case, whitespace-only variants as identical', () => {
    expect(normalizeDescription('Claude')).toBe(normalizeDescription('  claude  '))
    expect(normalizeDescription('CLAUDE')).toBe(normalizeDescription('claude'))
  })

  it('does not merge genuinely different descriptions', () => {
    expect(normalizeDescription('Claude')).not.toBe(normalizeDescription('Claude AI Pro'))
  })
})

describe('similarityScore', () => {
  it('scores identical strings as 1', () => {
    expect(similarityScore('Claude', 'Claude')).toBe(1)
  })

  it('scores unrelated strings low', () => {
    expect(similarityScore('Claude subscription', 'Grocery shopping')).toBeLessThan(0.2)
  })

  it('scores near-variants (Claude / Claude AI / Claude AI Pro) moderately high', () => {
    expect(similarityScore('Claude', 'Claude AI')).toBeGreaterThanOrEqual(0.5)
    expect(similarityScore('Claude AI', 'Claude AI Pro')).toBeGreaterThanOrEqual(0.5)
  })
})

describe('groupExactAliasCandidates', () => {
  it('groups only exact normalized duplicates, never fuzzy matches', () => {
    const groups = groupExactAliasCandidates(['Claude ', 'claude', 'CLAUDE', 'Claude AI Pro', 'Family Transfer', 'family transfer '])

    const claudeGroup = groups.find((g) => g.normalizedDescription === 'claude')
    expect(claudeGroup?.variants.sort()).toEqual(['CLAUDE', 'Claude ', 'claude'].sort())
    expect(claudeGroup?.occurrenceCount).toBe(3)

    // "Claude AI Pro" must NOT be folded into the "claude" group — that
    // would silently change what counts toward Claude spend without
    // confirmation.
    expect(groups.some((g) => g.normalizedDescription === 'claude ai pro')).toBe(false)

    const familyGroup = groups.find((g) => g.normalizedDescription === 'family transfer')
    expect(familyGroup?.variants).toHaveLength(2)
  })

  it('returns no groups when every description is unique', () => {
    expect(groupExactAliasCandidates(['Rent', 'Groceries', 'Gas'])).toEqual([])
  })
})
