import type { EngineTransaction } from '../types'

let idCounter = 0

export function tx(overrides: Partial<EngineTransaction> = {}): EngineTransaction {
  idCounter += 1
  return {
    id: overrides.id ?? `tx-${idCounter}`,
    date: '2026-07-01',
    type: 'expense',
    amount_krw: 10000,
    amount_usd: 7.3,
    currency: 'KRW',
    category_id: 'cat-food',
    category_name: 'Food & Dining',
    payment_method_id: 'pm-card',
    payment_method_name: 'Credit Card',
    description: 'Coffee',
    ...overrides,
  }
}
