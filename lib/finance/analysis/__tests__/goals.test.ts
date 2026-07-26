import { describe, it, expect } from 'vitest'
import { computeGoalPlan, detectDoubleCountingWarnings } from '../goals'
import type { EngineSavingsGoal, EngineSavingsContribution } from '../types'

function goal(overrides: Partial<EngineSavingsGoal> = {}): EngineSavingsGoal {
  return {
    id: 'goal-1',
    name: 'Life savings',
    target_usd: 5000,
    current_usd: 1000,
    deadline: '2027-01-01',
    auto_monthly_usd: 0,
    purpose: null,
    ...overrides,
  }
}

describe('computeGoalPlan — required monthly contribution', () => {
  it('computes the monthly amount needed to hit the deadline', () => {
    const referenceDate = new Date('2026-07-01T00:00:00')
    const plan = computeGoalPlan(goal({ target_usd: 5000, current_usd: 1000, deadline: '2027-01-01' }), [], referenceDate)
    // 6 months remaining, $4000 remaining -> ~$666.67/mo
    expect(plan.monthsRemaining).toBe(6)
    expect(plan.requiredMonthlyUsd).toBeCloseTo(666.67, 1)
  })

  it('matches the brief example: Life goal needing ~$250/mo instead of $150', () => {
    const referenceDate = new Date('2026-07-27T00:00:00')
    const plan = computeGoalPlan(
      goal({ name: 'Life', target_usd: 3000, current_usd: 0, deadline: '2027-07-27', auto_monthly_usd: 150 }),
      [],
      referenceDate
    )
    expect(plan.requiredMonthlyUsd).toBeGreaterThan(plan.currentPlannedMonthlyUsd)
    expect(plan.status).not.toBe('achieved')
  })
})

describe('computeGoalPlan — goal already above target', () => {
  it('reports achieved status with zero required contribution and a surplus', () => {
    const plan = computeGoalPlan(goal({ target_usd: 1000, current_usd: 1500, deadline: '2026-12-01' }))
    expect(plan.status).toBe('achieved')
    expect(plan.remainingUsd).toBe(0)
    expect(plan.surplusUsd).toBe(500)
    expect(plan.requiredMonthlyUsd).toBe(0)
  })
})

describe('computeGoalPlan — goals without a deadline', () => {
  it('has no required monthly figure but still projects from planned contributions', () => {
    const referenceDate = new Date('2026-07-01T00:00:00')
    const plan = computeGoalPlan(goal({ deadline: null, auto_monthly_usd: 200, current_usd: 0, target_usd: 1000 }), [], referenceDate)
    expect(plan.requiredMonthlyUsd).toBeNull()
    expect(plan.status).toBe('no_deadline')
    expect(plan.projectedCompletionDate).not.toBeNull()
  })
})

describe('computeGoalPlan — off track with no contribution rate', () => {
  it('flags off_track when there is a deadline but no money moving toward it', () => {
    const referenceDate = new Date('2026-07-01T00:00:00')
    const plan = computeGoalPlan(goal({ deadline: '2026-08-01', auto_monthly_usd: 0, current_usd: 0, target_usd: 1000 }), [], referenceDate)
    expect(plan.status).toBe('off_track')
    expect(plan.projectedCompletionDate).toBeNull()
  })
})

describe('detectDoubleCountingWarnings — duplicate-prepayment warning', () => {
  it('warns when two similarly-named goals both received a contribution in the same month', () => {
    const goals = [goal({ id: 'g1', name: 'Emergency Fund' }), goal({ id: 'g2', name: 'Emergency Fund 2' })]
    const contributions: EngineSavingsContribution[] = [
      { goal_id: 'g1', amount_usd: 200, contribution_month: '2026-07', source: 'manual', created_at: '2026-07-05T00:00:00Z' },
      { goal_id: 'g2', amount_usd: 200, contribution_month: '2026-07', source: 'manual', created_at: '2026-07-05T00:00:00Z' },
    ]
    const warnings = detectDoubleCountingWarnings(goals, contributions)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0].goalNames).toContain('Emergency Fund')
  })

  it('warns on near-identical goal names even without matching contributions', () => {
    const goals = [goal({ id: 'g1', name: 'Vacation Fund' }), goal({ id: 'g2', name: 'Vacation fund ' })]
    const warnings = detectDoubleCountingWarnings(goals, [])
    expect(warnings).toHaveLength(1)
  })

  it('does not warn for clearly distinct goals', () => {
    const goals = [goal({ id: 'g1', name: 'Vacation Fund' }), goal({ id: 'g2', name: 'New Laptop' })]
    const warnings = detectDoubleCountingWarnings(goals, [])
    expect(warnings).toHaveLength(0)
  })
})
