import { describe, it, expect } from 'vitest'
import { tx } from './fixtures'
import { detectSubscriptionCandidates } from '../subscriptions'

describe('detectSubscriptionCandidates', () => {
  it('detects a monthly subscription with a consistent amount', () => {
    const transactions = [
      tx({ description: 'Claude AI Pro', amount_krw: 27000, date: '2026-05-02', category_name: 'Subscriptions' }),
      tx({ description: 'Claude AI Pro', amount_krw: 27000, date: '2026-06-02', category_name: 'Subscriptions' }),
      tx({ description: 'Claude AI Pro', amount_krw: 27000, date: '2026-07-02', category_name: 'Subscriptions' }),
    ]
    const candidates = detectSubscriptionCandidates(transactions)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].frequency).toBe('monthly')
    expect(candidates[0].confidence).toBe('high')
    expect(candidates[0].estimatedYearlyCostKrw).toBe(27000 * 12)
  })

  it('clusters near-variant descriptions of the same merchant (Claude / Claude AI / Claude AI Pro)', () => {
    const transactions = [
      tx({ description: 'Claude', amount_krw: 20000, date: '2026-04-01' }),
      tx({ description: 'Claude AI', amount_krw: 20500, date: '2026-05-01' }),
      tx({ description: 'Claude AI Pro', amount_krw: 20800, date: '2026-06-02' }),
    ]
    const candidates = detectSubscriptionCandidates(transactions)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].occurrenceCount).toBe(3)
    expect(candidates[0].variantDescriptions.length).toBeGreaterThan(1)
  })

  it('detects an annual subscription', () => {
    const transactions = [
      tx({ description: 'Cloud Storage Yearly', amount_krw: 120000, date: '2025-01-10' }),
      tx({ description: 'Cloud Storage Yearly', amount_krw: 120000, date: '2026-01-10' }),
    ]
    const candidates = detectSubscriptionCandidates(transactions)
    expect(candidates[0].frequency).toBe('yearly')
    expect(candidates[0].estimatedYearlyCostKrw).toBe(120000)
  })

  it('does not flag a one-off purchase as a subscription', () => {
    const transactions = [tx({ description: 'New shoes', amount_krw: 89000, date: '2026-06-15' })]
    expect(detectSubscriptionCandidates(transactions)).toHaveLength(0)
  })

  it('does not flag two unrelated single purchases with different merchants as a subscription', () => {
    const transactions = [
      tx({ description: 'Grocery store', amount_krw: 45000, date: '2026-06-01' }),
      tx({ description: 'Electronics shop', amount_krw: 45000, date: '2026-06-20' }),
    ]
    expect(detectSubscriptionCandidates(transactions)).toHaveLength(0)
  })

  it('gives lower confidence to irregular repeat purchases (e.g. Coupang) than clean monthly cadence', () => {
    const irregular = detectSubscriptionCandidates([
      tx({ description: 'Coupang', amount_krw: 30000, date: '2026-05-01' }),
      tx({ description: 'Coupang', amount_krw: 32000, date: '2026-05-20' }),
      tx({ description: 'Coupang', amount_krw: 28000, date: '2026-06-25' }),
    ])
    expect(irregular[0].confidence).not.toBe('high')

    const monthly = detectSubscriptionCandidates([
      tx({ description: 'ChatGPT Plus', amount_krw: 30000, date: '2026-04-15' }),
      tx({ description: 'ChatGPT Plus', amount_krw: 30000, date: '2026-05-15' }),
      tx({ description: 'ChatGPT Plus', amount_krw: 30000, date: '2026-06-15' }),
    ])
    expect(monthly[0].confidence).toBe('high')
  })

  it('marks a candidate as matched when a recurring template exists', () => {
    const transactions = [
      tx({ description: 'Server hosting', amount_krw: 15000, date: '2026-05-05' }),
      tx({ description: 'Server hosting', amount_krw: 15000, date: '2026-06-05' }),
    ]
    const candidates = detectSubscriptionCandidates(transactions, [
      { description: 'Server hosting', amount_krw: 15000, category_name: 'Software' },
    ])
    expect(candidates[0].matchedRecurringTemplate).toBe(true)
    expect(candidates[0].confidence).toBe('high')
  })
})
