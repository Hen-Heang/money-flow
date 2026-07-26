import { describe, it, expect } from 'vitest'
import { tx } from './fixtures'
import { detectUnusualTransactions, detectPossibleDuplicateTransactions } from '../unusual'

describe('detectUnusualTransactions', () => {
  it('flags a transaction far above the typical amount for its category', () => {
    const transactions = [
      tx({ amount_krw: 10000, date: '2026-07-01' }),
      tx({ amount_krw: 11000, date: '2026-07-02' }),
      tx({ amount_krw: 9500, date: '2026-07-03' }),
      tx({ amount_krw: 10500, date: '2026-07-04' }),
      tx({ amount_krw: 10200, date: '2026-07-05' }),
      tx({ amount_krw: 250000, date: '2026-07-06', description: 'Big dinner' }),
    ]
    const unusual = detectUnusualTransactions(transactions)
    expect(unusual.some((u) => u.description === 'Big dinner')).toBe(true)
  })

  it('does not flag anything with too little history to judge', () => {
    const transactions = [tx({ amount_krw: 10000 }), tx({ amount_krw: 200000 })]
    expect(detectUnusualTransactions(transactions)).toEqual([])
  })

  it('returns nothing for empty transaction history', () => {
    expect(detectUnusualTransactions([])).toEqual([])
  })
})

describe('detectPossibleDuplicateTransactions — duplicate-prepayment warning', () => {
  it('flags a lunch coupon and an individual lunch charge as possible double counting', () => {
    const transactions = [
      tx({ id: 'a', description: 'Lunch', amount_krw: 12000, date: '2026-07-10' }),
      tx({ id: 'b', description: 'Lunch', amount_krw: 12000, date: '2026-07-10' }),
    ]
    const duplicates = detectPossibleDuplicateTransactions(transactions)
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].transactionIds.sort()).toEqual(['a', 'b'])
  })

  it('does not flag same-description transactions with different amounts', () => {
    const transactions = [
      tx({ id: 'a', description: 'Lunch', amount_krw: 12000, date: '2026-07-10' }),
      tx({ id: 'b', description: 'Lunch', amount_krw: 9000, date: '2026-07-10' }),
    ]
    expect(detectPossibleDuplicateTransactions(transactions)).toEqual([])
  })

  it('does not flag matching transactions more than a day apart', () => {
    const transactions = [
      tx({ id: 'a', description: 'Lunch', amount_krw: 12000, date: '2026-07-01' }),
      tx({ id: 'b', description: 'Lunch', amount_krw: 12000, date: '2026-07-10' }),
    ]
    expect(detectPossibleDuplicateTransactions(transactions)).toEqual([])
  })
})
