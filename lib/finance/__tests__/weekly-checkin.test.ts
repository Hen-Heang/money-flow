import { describe, it, expect } from 'vitest'
import { buildWeeklyCheckIn, isWithinQuietHours, renderWeeklyCheckInMessage } from '../weekly-checkin'
import { tx } from '@/lib/finance/analysis/__tests__/fixtures'

// Monday 2026-07-20. The reviewed week is 2026-07-13 (Mon) to 2026-07-19 (Sun).
const REFERENCE = new Date('2026-07-20T09:00:00')

const identity = (s: string) => s

describe('buildWeeklyCheckIn', () => {
  it('summarises the week just finished, not the current partial week', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [
        tx({ type: 'income', amount_krw: 2_000_000, date: '2026-07-15' }),
        tx({ type: 'expense', amount_krw: 50_000, date: '2026-07-15' }),
        tx({ type: 'expense', amount_krw: 30_000, date: '2026-07-18' }),
        // Today — outside the reviewed week.
        tx({ type: 'expense', amount_krw: 999_000, date: '2026-07-20' }),
      ],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    expect(checkIn.weekStart).toBe('2026-07-13')
    expect(checkIn.weekEnd).toBe('2026-07-19')
    expect(checkIn.incomeKrw).toBe(2_000_000)
    expect(checkIn.expenseKrw).toBe(80_000)
  })

  it('compares against the previous week', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [
        tx({ type: 'expense', amount_krw: 80_000, date: '2026-07-15' }),
        tx({ type: 'expense', amount_krw: 100_000, date: '2026-07-08' }),
      ],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    expect(checkIn.previousExpenseKrw).toBe(100_000)
    expect(checkIn.changePct).toBe(-20)
  })

  it('reports the top three categories', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [
        tx({ category_id: 'a', category_name: 'Food', amount_krw: 100_000, date: '2026-07-15' }),
        tx({ category_id: 'b', category_name: 'Transport', amount_krw: 50_000, date: '2026-07-15' }),
        tx({ category_id: 'c', category_name: 'Drinks', amount_krw: 30_000, date: '2026-07-16' }),
        tx({ category_id: 'd', category_name: 'Books', amount_krw: 10_000, date: '2026-07-17' }),
      ],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    expect(checkIn.topCategories).toHaveLength(3)
    expect(checkIn.topCategories[0]).toEqual({ name: 'Food', totalKrw: 100_000 })
  })

  it('suggests acting on an over-budget category first', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [tx({ category_id: 'a', category_name: 'Food', amount_krw: 400_000, date: '2026-07-15' })],
      budgets: [{ category_id: 'a', category_name: 'Food', amount_krw: 300_000 }],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    expect(checkIn.budgetProgress[0].overBudget).toBe(true)
    expect(checkIn.suggestedAction).toContain('Food')
    expect(checkIn.suggestedAction).toContain('passed its monthly plan')
  })

  it('always returns exactly one suggested action, even with no data', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    expect(checkIn.expenseKrw).toBe(0)
    expect(checkIn.changePct).toBeNull()
    expect(checkIn.suggestedAction.length).toBeGreaterThan(0)
  })

  it('uses non-judgemental language', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [tx({ category_id: 'a', category_name: 'Food', amount_krw: 400_000, date: '2026-07-15' })],
      budgets: [{ category_id: 'a', category_name: 'Food', amount_krw: 300_000 }],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    const text = checkIn.suggestedAction.toLowerCase()
    expect(text).not.toContain('failed')
    expect(text).not.toContain('bad')
    expect(text).not.toContain('wasted')
  })
})

describe('renderWeeklyCheckInMessage', () => {
  it('includes every required section', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [
        tx({ type: 'income', amount_krw: 2_000_000, date: '2026-07-15' }),
        tx({ category_id: 'a', category_name: 'Food', amount_krw: 120_000, date: '2026-07-15' }),
      ],
      budgets: [{ category_id: 'a', category_name: 'Food', amount_krw: 300_000 }],
      savingsGoals: [
        { id: 'g1', name: 'Life', target_usd: 5000, current_usd: 500, deadline: '2027-01-01', auto_monthly_usd: 150, purpose: null },
      ],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    const message = renderWeeklyCheckInMessage(checkIn, identity)
    expect(message).toContain('Weekly check-in')
    expect(message).toContain('Spent')
    expect(message).toContain('Received')
    expect(message).toContain('Top categories')
    expect(message).toContain('Budget progress')
    expect(message).toContain('Savings')
    expect(message).toContain('This week:')
  })

  it('escapes user-controlled text through the provided escaper', () => {
    const checkIn = buildWeeklyCheckIn({
      transactions: [tx({ category_id: 'a', category_name: '<script>', amount_krw: 10_000, date: '2026-07-15' })],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      referenceDate: REFERENCE,
    })

    const message = renderWeeklyCheckInMessage(checkIn, (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    expect(message).toContain('&lt;script&gt;')
    expect(message).not.toContain('<script>')
  })
})

describe('isWithinQuietHours', () => {
  const base = { enabled: true, start: '22:00', end: '08:00', timezone: 'Asia/Seoul' }

  it('returns false when quiet hours are disabled', () => {
    expect(isWithinQuietHours({ ...base, enabled: false }, new Date('2026-07-20T15:00:00Z'))).toBe(false)
  })

  it('detects a window that wraps past midnight', () => {
    // 23:00 KST = 14:00 UTC
    expect(isWithinQuietHours(base, new Date('2026-07-20T14:00:00Z'))).toBe(true)
    // 03:00 KST = 18:00 UTC previous day
    expect(isWithinQuietHours(base, new Date('2026-07-19T18:00:00Z'))).toBe(true)
    // 12:00 KST = 03:00 UTC
    expect(isWithinQuietHours(base, new Date('2026-07-20T03:00:00Z'))).toBe(false)
  })

  it('handles a same-day window', () => {
    const daytime = { ...base, start: '09:00', end: '17:00' }
    // 12:00 KST = 03:00 UTC
    expect(isWithinQuietHours(daytime, new Date('2026-07-20T03:00:00Z'))).toBe(true)
    // 20:00 KST = 11:00 UTC
    expect(isWithinQuietHours(daytime, new Date('2026-07-20T11:00:00Z'))).toBe(false)
  })

  it('treats an identical start and end as no quiet window', () => {
    expect(isWithinQuietHours({ ...base, start: '10:00', end: '10:00' }, new Date('2026-07-20T01:00:00Z'))).toBe(false)
  })

  it('does not silence notifications when the timezone is invalid', () => {
    expect(isWithinQuietHours({ ...base, timezone: 'Not/AZone' }, new Date('2026-07-20T14:00:00Z'))).toBe(false)
  })
})
