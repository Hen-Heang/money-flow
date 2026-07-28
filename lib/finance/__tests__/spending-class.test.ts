import { describe, it, expect } from 'vitest'
import { SPENDING_CLASSES, SPENDING_CLASS_BY_VALUE, spendingClassLabel, spendingClassColor, UNCLASSIFIED_META } from '../spending-class'
import { buildBudgetPlan } from '@/lib/finance/analysis'
import { tx } from '@/lib/finance/analysis/__tests__/fixtures'

const REFERENCE = new Date('2026-07-15T12:00:00')

describe('spending class metadata', () => {
  it('covers every class the database accepts', () => {
    expect(SPENDING_CLASSES.map((c) => c.value).sort()).toEqual(
      ['avoidable', 'commitment', 'essential', 'flexible', 'growth'].sort()
    )
  })

  it('exposes a lookup for each class', () => {
    for (const meta of SPENDING_CLASSES) {
      expect(SPENDING_CLASS_BY_VALUE[meta.value]).toBe(meta)
    }
  })

  it('falls back to the unclassified label and colour', () => {
    expect(spendingClassLabel(null)).toBe(UNCLASSIFIED_META.label)
    expect(spendingClassLabel(undefined)).toBe(UNCLASSIFIED_META.label)
    expect(spendingClassColor(null)).toBe(UNCLASSIFIED_META.color)
    expect(spendingClassLabel('flexible')).toBe('Flexible')
  })

  it('only promises a trim for the two discretionary classes', () => {
    const trimming = SPENDING_CLASSES.filter((c) => c.effect.includes('trim')).map((c) => c.value)
    expect(trimming.sort()).toEqual(['avoidable', 'flexible'])
  })
})

// The metadata is user-facing copy describing engine behaviour — if the two
// ever drift, the UI would be lying about what happens.
describe('metadata matches engine behaviour', () => {
  function planFor(spendingClass: Parameters<typeof buildBudgetPlan>[0]['classifications'] extends Record<string, infer C> ? C : never) {
    return buildBudgetPlan({
      transactions: [
        tx({ category_id: 'c1', category_name: 'Test', amount_krw: 100_000, date: '2026-04-10' }),
        tx({ category_id: 'c1', category_name: 'Test', amount_krw: 100_000, date: '2026-05-10' }),
        tx({ category_id: 'c1', category_name: 'Test', amount_krw: 100_000, date: '2026-06-10' }),
      ],
      budgets: [],
      classifications: { c1: spendingClass },
      incomeBaselineKrw: 3_000_000,
      referenceDate: REFERENCE,
    }).recommendations[0]
  }

  it('trims flexible by roughly the advertised 10%', () => {
    expect(planFor('flexible').recommendedBudgetKrw).toBe(90_000)
  })

  it('trims avoidable by roughly the advertised 20%', () => {
    expect(planFor('avoidable').recommendedBudgetKrw).toBe(80_000)
  })

  it('leaves the three protected classes untouched', () => {
    for (const value of ['essential', 'commitment', 'growth'] as const) {
      expect(planFor(value).recommendedBudgetKrw, `${value} should not be trimmed`).toBe(100_000)
    }
  })
})
