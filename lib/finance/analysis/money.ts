// Decimal-safe money helpers. All monetary aggregation in the finance engine
// must go through these instead of native +/- to avoid floating-point drift
// when summing many transactions.

import Decimal from 'decimal.js'

export type Money = Decimal

export function money(value: number | string | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  const d = new Decimal(value)
  return d.isFinite() ? d : new Decimal(0)
}

export function sumMoney(values: Array<number | string | null | undefined>): Decimal {
  return values.reduce((acc: Decimal, v) => acc.plus(money(v)), new Decimal(0))
}

// KRW has no meaningful subunit in this app's data — round to whole won.
export function roundKRW(value: Decimal | number): number {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

// USD keeps cents.
export function roundUSD(value: Decimal | number): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
}

export function pct(part: Decimal | number, whole: Decimal | number, decimals = 1): number {
  const w = new Decimal(whole)
  if (w.isZero()) return 0
  return new Decimal(part).dividedBy(w).times(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()
}

export function safeDiv(a: Decimal | number, b: Decimal | number, fallback: Decimal = new Decimal(0)): Decimal {
  const denom = new Decimal(b)
  if (denom.isZero()) return fallback
  return new Decimal(a).dividedBy(denom)
}
