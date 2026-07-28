import { describe, it, expect } from 'vitest'
import { sumMoney, roundKRW, roundUSD, pct, safeDiv, money } from '../money'

describe('money helpers', () => {
  it('sums without floating point drift', () => {
    // Classic float trap: 0.1 + 0.2 !== 0.3 in native JS arithmetic.
    const result = sumMoney([0.1, 0.2])
    expect(roundUSD(result)).toBe(0.3)
  })

  it('sums many small USD contributions precisely', () => {
    const values = Array(1000).fill(0.01)
    const result = sumMoney(values)
    expect(roundUSD(result)).toBe(10)
  })

  it('rounds KRW to whole won', () => {
    expect(roundKRW(1234.6)).toBe(1235)
    expect(roundKRW(1234.4)).toBe(1234)
  })

  it('computes percentage safely, including zero denominator', () => {
    expect(pct(50, 200)).toBe(25)
    expect(pct(50, 0)).toBe(0)
  })

  it('safeDiv returns fallback on divide-by-zero', () => {
    expect(safeDiv(money(100), money(0)).toNumber()).toBe(0)
    expect(safeDiv(money(100), money(4)).toNumber()).toBe(25)
  })

  it('treats null/undefined/empty as zero', () => {
    expect(sumMoney([null, undefined, '']).toNumber()).toBe(0)
  })
})
