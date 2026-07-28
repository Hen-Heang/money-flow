import { describe, it, expect } from 'vitest'
import { computeCategoryComparison, findBestImprovement, findBiggestIncrease } from '../monthly-review'
import type { CategoryBreakdownEntry } from '../types'

function entry(name: string, total: number, id: string | null = `cat-${name}`): CategoryBreakdownEntry {
  return { category_id: id, category_name: name, totalKrw: total, pctOfTotal: 0, transactionCount: 1 }
}

describe('computeCategoryComparison', () => {
  it('reports deltas and direction for categories in both months', () => {
    const comparison = computeCategoryComparison(
      [entry('Food', 400_000), entry('Transport', 50_000)],
      [entry('Food', 500_000), entry('Transport', 40_000)]
    )

    const food = comparison.find((c) => c.categoryName === 'Food')!
    expect(food.deltaKrw).toBe(-100_000)
    expect(food.deltaPct).toBe(-20)
    expect(food.direction).toBe('down')

    const transport = comparison.find((c) => c.categoryName === 'Transport')!
    expect(transport.deltaKrw).toBe(10_000)
    expect(transport.direction).toBe('up')
  })

  it('includes a category that only appeared this month', () => {
    const comparison = computeCategoryComparison([entry('Health', 30_000)], [])
    expect(comparison[0].direction).toBe('new')
    expect(comparison[0].previousKrw).toBe(0)
    expect(comparison[0].deltaPct).toBeNull()
  })

  it('includes a category that stopped this month', () => {
    const comparison = computeCategoryComparison([], [entry('Gym', 60_000)])
    expect(comparison[0].direction).toBe('stopped')
    expect(comparison[0].currentKrw).toBe(0)
    expect(comparison[0].deltaKrw).toBe(-60_000)
  })

  it('handles two empty months', () => {
    expect(computeCategoryComparison([], [])).toEqual([])
  })
})

describe('findBestImprovement', () => {
  it('finds the category that fell the most', () => {
    const comparison = computeCategoryComparison(
      [entry('Food', 400_000), entry('Shopping', 20_000)],
      [entry('Food', 500_000), entry('Shopping', 150_000)]
    )
    // Shopping fell ₩130,000 vs Food's ₩100,000.
    expect(findBestImprovement(comparison)?.categoryName).toBe('Shopping')
  })

  it('credits a category that stopped entirely — cancelling a cost is a real improvement', () => {
    const comparison = computeCategoryComparison([], [entry('Gym', 60_000)])
    expect(findBestImprovement(comparison)?.categoryName).toBe('Gym')
  })

  it('returns null when nothing improved', () => {
    const comparison = computeCategoryComparison([entry('Food', 500_000)], [entry('Food', 400_000)])
    expect(findBestImprovement(comparison)).toBeNull()
  })
})

describe('findBiggestIncrease', () => {
  it('finds the category that grew the most', () => {
    const comparison = computeCategoryComparison(
      [entry('Food', 500_000), entry('Drinks', 90_000)],
      [entry('Food', 480_000), entry('Drinks', 30_000)]
    )
    expect(findBiggestIncrease(comparison)?.categoryName).toBe('Drinks')
  })

  it('ignores brand-new categories with no prior baseline', () => {
    const comparison = computeCategoryComparison([entry('Health', 300_000)], [])
    expect(findBiggestIncrease(comparison)).toBeNull()
  })

  it('returns null when nothing increased', () => {
    const comparison = computeCategoryComparison([entry('Food', 400_000)], [entry('Food', 500_000)])
    expect(findBiggestIncrease(comparison)).toBeNull()
  })
})
