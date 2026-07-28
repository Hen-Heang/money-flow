// Savings-goal math (Feature 6). Pure calculations only — nothing here
// writes to `current_usd`; deposits only happen through the confirmed
// contribution ledger (record_savings_contribution RPC).

import Decimal from 'decimal.js'
import { money, sumMoney, roundUSD, safeDiv } from './money'
import { similarityScore } from './normalize'
import type { EngineSavingsGoal, EngineSavingsContribution, GoalStatus } from './types'

export interface GoalPlan {
  goalId: string
  name: string
  targetUsd: number
  currentUsd: number
  remainingUsd: number
  surplusUsd: number
  deadline: string | null
  monthsRemaining: number | null
  currentPlannedMonthlyUsd: number
  requiredMonthlyUsd: number | null
  effectiveMonthlyRateUsd: number
  projectedCompletionDate: string | null
  status: GoalStatus
}

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear()
  const months = to.getMonth() - from.getMonth()
  let total = years * 12 + months
  if (to.getDate() < from.getDate()) total -= 1
  return total
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Average confirmed contribution rate over the last N months, used as the
// "effective" monthly rate when no explicit plan (auto_monthly_usd) exists.
function recentContributionRate(contributions: EngineSavingsContribution[], referenceDate: Date, lookbackMonths = 3): number {
  const cutoff = addMonths(referenceDate, -lookbackMonths)
  const cutoffMonth = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  const recent = contributions.filter((c) => c.contribution_month >= cutoffMonth)
  if (recent.length === 0) return 0
  const months = new Set(recent.map((c) => c.contribution_month))
  const total = sumMoney(recent.map((c) => c.amount_usd))
  return roundUSD(safeDiv(total, months.size))
}

export function computeGoalPlan(
  goal: EngineSavingsGoal,
  contributions: EngineSavingsContribution[] = [],
  referenceDate: Date = new Date()
): GoalPlan {
  const target = money(goal.target_usd)
  const current = money(goal.current_usd)
  const remaining = Decimal.max(target.minus(current), 0)
  const surplus = Decimal.max(current.minus(target), 0)
  const achieved = current.greaterThanOrEqualTo(target)

  const deadlineDate = goal.deadline ? new Date(`${goal.deadline}T00:00:00`) : null
  const monthsRemaining = deadlineDate ? Math.max(monthsBetween(referenceDate, deadlineDate), 0) : null

  let requiredMonthlyUsd: number | null = null
  if (achieved) {
    requiredMonthlyUsd = 0
  } else if (monthsRemaining !== null) {
    // Deadline within the current month (or already passed but not yet
    // achieved): the whole remaining amount is "due" now.
    requiredMonthlyUsd = roundUSD(safeDiv(remaining, Math.max(monthsRemaining, 1)))
  }

  const ownContributions = contributions.filter((c) => c.goal_id === goal.id)
  const effectiveMonthlyRate =
    goal.auto_monthly_usd > 0 ? goal.auto_monthly_usd : recentContributionRate(ownContributions, referenceDate)

  let projectedCompletionDate: string | null = null
  if (achieved) {
    projectedCompletionDate = toISODate(referenceDate)
  } else if (effectiveMonthlyRate > 0) {
    const monthsToComplete = Decimal.ceil(safeDiv(remaining, effectiveMonthlyRate)).toNumber()
    projectedCompletionDate = toISODate(addMonths(referenceDate, monthsToComplete))
  }

  let status: GoalStatus
  if (achieved) {
    status = 'achieved'
  } else if (!deadlineDate) {
    status = 'no_deadline'
  } else if (effectiveMonthlyRate <= 0) {
    status = 'off_track'
  } else if (projectedCompletionDate && projectedCompletionDate <= goal.deadline!) {
    status = 'on_track'
  } else {
    const projected = new Date(`${projectedCompletionDate}T00:00:00`)
    const monthsLate = monthsBetween(deadlineDate, projected)
    status = monthsLate <= 2 ? 'at_risk' : 'off_track'
  }

  return {
    goalId: goal.id,
    name: goal.name,
    targetUsd: roundUSD(target),
    currentUsd: roundUSD(current),
    remainingUsd: roundUSD(remaining),
    surplusUsd: roundUSD(surplus),
    deadline: goal.deadline,
    monthsRemaining,
    currentPlannedMonthlyUsd: goal.auto_monthly_usd,
    requiredMonthlyUsd,
    effectiveMonthlyRateUsd: effectiveMonthlyRate,
    projectedCompletionDate,
    status,
  }
}

export interface DoubleCountingWarning {
  goalIds: [string, string]
  goalNames: [string, string]
  reason: string
}

const NAME_SIMILARITY_THRESHOLD = 0.6

// Heuristic only — we can never know if two goals track the same real-world
// balance. Flags likely-duplicate goals (near-identical names, or
// contributions of the same amount recorded on the same day) so the user can
// confirm whether the money is actually separate.
export function detectDoubleCountingWarnings(
  goals: EngineSavingsGoal[],
  contributions: EngineSavingsContribution[] = []
): DoubleCountingWarning[] {
  const warnings: DoubleCountingWarning[] = []

  for (let i = 0; i < goals.length; i++) {
    for (let j = i + 1; j < goals.length; j++) {
      const a = goals[i]
      const b = goals[j]
      const nameSim = similarityScore(a.name, b.name)

      if (nameSim >= NAME_SIMILARITY_THRESHOLD) {
        warnings.push({
          goalIds: [a.id, b.id],
          goalNames: [a.name, b.name],
          reason: `"${a.name}" and "${b.name}" have very similar names — confirm these track separate real-world balances.`,
        })
        continue
      }

      const aContribs = contributions.filter((c) => c.goal_id === a.id)
      const bContribs = contributions.filter((c) => c.goal_id === b.id)
      const overlap = aContribs.some((ac) =>
        bContribs.some(
          (bc) => bc.contribution_month === ac.contribution_month && Math.abs(bc.amount_usd - ac.amount_usd) < 0.01
        )
      )
      if (overlap) {
        warnings.push({
          goalIds: [a.id, b.id],
          goalNames: [a.name, b.name],
          reason: `"${a.name}" and "${b.name}" both received a matching contribution in the same month — confirm this wasn't the same deposit logged twice.`,
        })
      }
    }
  }

  return warnings
}
