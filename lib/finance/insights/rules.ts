// Deterministic insight generation (Feature 4).
//
// Every number in every insight is computed here, from engine output. The AI
// layer may only rewrite `title` and `summary` into friendlier prose — see
// lib/finance/insights/ai.ts, which rejects any phrasing that introduces a
// number this file did not produce.

import { money, roundKRW, roundUSD, pct, safeDiv } from '@/lib/finance/analysis'
import type { FinancialSnapshot, BudgetPlanResult } from '@/lib/finance/analysis'
import type { InsightType, InsightSeverity, InsightConfidence, FinancialPreferences } from '@/lib/types'

export type InsightRole = 'positive' | 'warning' | 'action'

export type InsightActionKind =
  | 'adjust_budget'
  | 'review_subscriptions'
  | 'review_goal_plan'
  | 'review_duplicates'
  | 'view_analytics'
  | 'none'

export interface InsightAction {
  kind: InsightActionKind
  label: string
  href?: string
  categoryId?: string
  categoryName?: string
  currentValueKrw?: number
  proposedValueKrw?: number
  goalId?: string
  goalName?: string
  currentMonthlyUsd?: number
  proposedMonthlyUsd?: number
}

export interface InsightCandidate {
  key: string
  role: InsightRole
  insight_type: InsightType
  severity: InsightSeverity
  title: string
  summary: string
  evidence: Record<string, unknown>
  estimated_monthly_savings_krw: number | null
  confidence: InsightConfidence
  priority: number
  action: InsightAction
  period_start: string
  period_end: string
}

function krw(value: number): string {
  return `₩${Math.round(value).toLocaleString('en-US')}`
}

function usd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const NO_ACTION: InsightAction = { kind: 'none', label: '' }

export interface GenerateInsightsInput {
  snapshot: FinancialSnapshot
  budgetPlan?: BudgetPlanResult
  preferences: FinancialPreferences
  referenceDate?: Date
}

function monthPeriod(referenceDate: Date): { start: string; end: string } {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function generateInsightCandidates(input: GenerateInsightsInput): InsightCandidate[] {
  const { snapshot, budgetPlan, preferences } = input
  const referenceDate = input.referenceDate ?? new Date()
  const { start: period_start, end: period_end } = monthPeriod(referenceDate)
  const candidates: InsightCandidate[] = []

  const base = { period_start, period_end }
  const { dailyPace, currentMonth, previousMonth, monthOverMonth } = snapshot

  // ── Positive ──────────────────────────────────────────────────────────

  const savingsRateDelta = currentMonth.savingsRatePct - previousMonth.savingsRatePct
  if (currentMonth.totalIncomeKrw > 0 && previousMonth.totalIncomeKrw > 0 && savingsRateDelta >= 2) {
    candidates.push({
      ...base,
      key: 'positive:savings-rate-improved',
      role: 'positive',
      insight_type: 'positive_trend',
      severity: 'positive',
      title: 'Your savings rate improved this month',
      summary: `You are keeping ${currentMonth.savingsRatePct}% of your income this month, up from ${previousMonth.savingsRatePct}% last month.`,
      evidence: {
        currentSavingsRatePct: currentMonth.savingsRatePct,
        previousSavingsRatePct: previousMonth.savingsRatePct,
        improvementPoints: Math.round(savingsRateDelta * 10) / 10,
        currentNetCashFlowKrw: currentMonth.netCashFlowKrw,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'high',
      priority: 60 + savingsRateDelta,
      action: NO_ACTION,
    })
  }

  if (monthOverMonth.direction === 'down' && monthOverMonth.deltaPct !== null && monthOverMonth.deltaPct <= -5) {
    candidates.push({
      ...base,
      key: 'positive:spending-down',
      role: 'positive',
      insight_type: 'positive_trend',
      severity: 'positive',
      title: 'Spending is lower than last month',
      summary: `You have spent ${krw(Math.abs(monthOverMonth.deltaKrw))} less than at this point last month.`,
      evidence: {
        currentExpenseKrw: monthOverMonth.currentKrw,
        previousExpenseKrw: monthOverMonth.previousKrw,
        differenceKrw: Math.abs(monthOverMonth.deltaKrw),
        changePct: monthOverMonth.deltaPct,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'high',
      priority: 55 + Math.abs(monthOverMonth.deltaPct),
      action: NO_ACTION,
    })
  }

  const achievedGoals = snapshot.goalPlans.filter((g) => g.status === 'achieved')
  if (achievedGoals.length > 0) {
    const goal = achievedGoals[0]
    candidates.push({
      ...base,
      key: `positive:goal-achieved:${goal.goalId}`,
      role: 'positive',
      insight_type: 'savings_goal',
      severity: 'positive',
      title: `${goal.name} has reached its target`,
      summary:
        goal.surplusUsd > 0
          ? `${goal.name} is at ${usd(goal.currentUsd)} against a ${usd(goal.targetUsd)} target — ${usd(goal.surplusUsd)} above plan.`
          : `${goal.name} has reached its ${usd(goal.targetUsd)} target.`,
      evidence: {
        goalName: goal.name,
        currentUsd: goal.currentUsd,
        targetUsd: goal.targetUsd,
        surplusUsd: goal.surplusUsd,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'high',
      priority: 58,
      action: { kind: 'review_goal_plan', label: 'Review goal', href: '/savings', goalId: goal.goalId, goalName: goal.name },
    })
  }

  const onTrackGoals = snapshot.goalPlans.filter((g) => g.status === 'on_track')
  if (onTrackGoals.length > 0 && achievedGoals.length === 0) {
    const goal = onTrackGoals[0]
    candidates.push({
      ...base,
      key: `positive:goal-on-track:${goal.goalId}`,
      role: 'positive',
      insight_type: 'savings_goal',
      severity: 'positive',
      title: `${goal.name} is on schedule`,
      summary: `At ${usd(goal.effectiveMonthlyRateUsd)} per month, ${goal.name} is on track to reach ${usd(goal.targetUsd)} by its deadline.`,
      evidence: {
        goalName: goal.name,
        monthlyRateUsd: goal.effectiveMonthlyRateUsd,
        targetUsd: goal.targetUsd,
        currentUsd: goal.currentUsd,
        projectedCompletionDate: goal.projectedCompletionDate,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'high',
      priority: 50,
      action: NO_ACTION,
    })
  }

  // ── Warnings ──────────────────────────────────────────────────────────

  // Project each budgeted category forward at its current pace so an
  // overspend can be flagged before it happens, not after.
  if (dailyPace.isCurrentMonth && dailyPace.daysPassed > 0) {
    for (const usage of snapshot.budgetUsage) {
      if (usage.budgetKrw <= 0) continue
      const projected = roundKRW(safeDiv(money(usage.spentKrw), dailyPace.daysPassed).times(dailyPace.daysInMonth))
      const alreadyOver = usage.overBudget
      if (!alreadyOver && projected <= usage.budgetKrw) continue

      const overshoot = alreadyOver ? usage.spentKrw - usage.budgetKrw : projected - usage.budgetKrw
      candidates.push({
        ...base,
        key: `warning:budget:${usage.category_id}`,
        role: 'warning',
        insight_type: 'category_overspend',
        severity: alreadyOver ? 'critical' : 'warning',
        title: alreadyOver
          ? `${usage.category_name} has passed its plan`
          : `${usage.category_name} spending may exceed its budget by ${krw(overshoot)}`,
        summary: alreadyOver
          ? `${usage.category_name} is at ${krw(usage.spentKrw)} against a ${krw(usage.budgetKrw)} plan, ${krw(overshoot)} above it with ${dailyPace.daysRemaining} days left.`
          : `${usage.category_name} is at ${krw(usage.spentKrw)} of ${krw(usage.budgetKrw)} after ${dailyPace.daysPassed} days. At this pace it reaches about ${krw(projected)} by month end.`,
        evidence: {
          category: usage.category_name,
          spentKrw: usage.spentKrw,
          budgetKrw: usage.budgetKrw,
          projectedKrw: projected,
          overshootKrw: overshoot,
          usagePct: usage.usagePct,
          daysPassed: dailyPace.daysPassed,
          daysRemaining: dailyPace.daysRemaining,
        },
        estimated_monthly_savings_krw: overshoot,
        confidence: dailyPace.daysPassed >= 7 ? 'high' : 'medium',
        priority: 100 + overshoot / 1000 + (alreadyOver ? 50 : 0),
        action: {
          kind: 'view_analytics',
          label: 'Review category',
          href: '/analytics',
          categoryId: usage.category_id,
          categoryName: usage.category_name,
        },
      })
    }
  }

  // Projected spending above the conservative income baseline is the most
  // serious signal the engine produces.
  const baseline = snapshot.incomeBaseline.conservativeBaselineKrw
  if (baseline > 0 && dailyPace.isCurrentMonth && dailyPace.projectedEndOfMonthKrw > baseline) {
    const excess = dailyPace.projectedEndOfMonthKrw - baseline
    candidates.push({
      ...base,
      key: 'warning:above-income-baseline',
      role: 'warning',
      insight_type: 'income_baseline',
      severity: 'critical',
      title: 'Projected spending is above your usual income',
      summary: `At the current pace this month ends around ${krw(dailyPace.projectedEndOfMonthKrw)}, which is ${krw(excess)} more than your typical monthly income of ${krw(baseline)}.`,
      evidence: {
        projectedSpendingKrw: dailyPace.projectedEndOfMonthKrw,
        incomeBaselineKrw: baseline,
        excessKrw: excess,
        monthsOfIncomeData: snapshot.incomeBaseline.monthsUsed,
        basedOnPartialData: snapshot.incomeBaseline.basedOnPartialData,
      },
      estimated_monthly_savings_krw: excess,
      confidence: snapshot.incomeBaseline.basedOnPartialData ? 'low' : 'high',
      priority: 200 + excess / 1000,
      action: { kind: 'view_analytics', label: 'Review spending', href: '/analytics' },
    })
  }

  if (snapshot.possibleDuplicates.length > 0) {
    const dup = snapshot.possibleDuplicates[0]
    const totalKrw = roundKRW(
      snapshot.possibleDuplicates.reduce((sum, d) => sum.plus(money(d.amountKrw)), money(0))
    )
    candidates.push({
      ...base,
      key: 'warning:possible-duplicates',
      role: 'warning',
      insight_type: 'duplicate_transaction',
      severity: 'info',
      title: `${snapshot.possibleDuplicates.length} transactions may be counted twice`,
      summary: `"${dup.description}" appears more than once for ${krw(dup.amountKrw)} within a day. Worth checking these are separate purchases.`,
      evidence: {
        duplicateCount: snapshot.possibleDuplicates.length,
        totalAmountKrw: totalKrw,
        sampleDescription: dup.description,
        sampleAmountKrw: dup.amountKrw,
        sampleDate: dup.date,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'medium',
      priority: 70,
      action: { kind: 'review_duplicates', label: 'Review transactions', href: '/transactions' },
    })
  }

  const highlyUnusual = snapshot.unusualTransactions.filter((u) => u.severity === 'high')
  if (highlyUnusual.length > 0) {
    const unusual = highlyUnusual[0]
    candidates.push({
      ...base,
      key: 'warning:unusual-transaction',
      role: 'warning',
      insight_type: 'unusual_transaction',
      severity: 'info',
      title: 'One expense stands out this month',
      summary: `"${unusual.description}" at ${krw(unusual.amountKrw)} is much larger than your usual ${unusual.categoryName ?? 'spending'} in this category. This may be worth reviewing.`,
      evidence: {
        description: unusual.description,
        amountKrw: unusual.amountKrw,
        category: unusual.categoryName,
        date: unusual.date,
        unusualCount: highlyUnusual.length,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'medium',
      priority: 65,
      action: { kind: 'view_analytics', label: 'Review transaction', href: '/transactions' },
    })
  }

  if (snapshot.doubleCountingWarnings.length > 0) {
    const warning = snapshot.doubleCountingWarnings[0]
    candidates.push({
      ...base,
      key: 'warning:double-counting',
      role: 'warning',
      insight_type: 'double_counting',
      severity: 'info',
      title: 'Two savings goals may track the same money',
      summary: warning.reason,
      evidence: { goalNames: warning.goalNames, warningCount: snapshot.doubleCountingWarnings.length },
      estimated_monthly_savings_krw: null,
      confidence: 'low',
      priority: 62,
      action: { kind: 'review_goal_plan', label: 'Review goals', href: '/savings' },
    })
  }

  // ── Recommended actions ───────────────────────────────────────────────

  // A goal whose deadline needs more than what is actually being set aside.
  const behindGoals = snapshot.goalPlans
    .filter((g) => g.status === 'at_risk' || g.status === 'off_track')
    .filter((g) => g.requiredMonthlyUsd !== null && g.requiredMonthlyUsd > 0)
    .sort((a, b) => (b.requiredMonthlyUsd ?? 0) - (a.requiredMonthlyUsd ?? 0))

  if (behindGoals.length > 0) {
    const goal = behindGoals[0]
    const required = goal.requiredMonthlyUsd!
    const shortfall = roundUSD(Math.max(required - goal.currentPlannedMonthlyUsd, 0))
    candidates.push({
      ...base,
      key: `action:goal-plan:${goal.goalId}`,
      role: 'action',
      insight_type: 'savings_goal',
      severity: 'warning',
      title: `${goal.name} needs about ${usd(required)} per month to meet its deadline`,
      summary:
        goal.currentPlannedMonthlyUsd > 0
          ? `${goal.name} is planned at ${usd(goal.currentPlannedMonthlyUsd)} a month, but reaching ${usd(goal.targetUsd)} by ${goal.deadline} needs about ${usd(required)} — ${usd(shortfall)} more each month.`
          : `${goal.name} has no monthly plan yet. Reaching ${usd(goal.targetUsd)} by ${goal.deadline} needs about ${usd(required)} a month.`,
      evidence: {
        goalName: goal.name,
        targetUsd: goal.targetUsd,
        currentUsd: goal.currentUsd,
        remainingUsd: goal.remainingUsd,
        deadline: goal.deadline,
        monthsRemaining: goal.monthsRemaining,
        plannedMonthlyUsd: goal.currentPlannedMonthlyUsd,
        requiredMonthlyUsd: required,
        shortfallUsd: shortfall,
        status: goal.status,
      },
      estimated_monthly_savings_krw: null,
      confidence: 'high',
      priority: 120,
      action: {
        kind: 'review_goal_plan',
        label: 'Create contribution plan',
        href: '/savings',
        goalId: goal.goalId,
        goalName: goal.name,
        currentMonthlyUsd: goal.currentPlannedMonthlyUsd,
        proposedMonthlyUsd: required,
      },
    })
  }

  // Subscriptions: compare the monthly-equivalent cost against a budget for
  // the category they land in, when one exists.
  if (snapshot.subscriptionCandidates.length > 0) {
    const monthlyEquivalent = roundKRW(
      snapshot.subscriptionCandidates.reduce((sum, s) => sum.plus(safeDiv(money(s.estimatedYearlyCostKrw), 12)), money(0))
    )
    const yearlyTotal = roundKRW(
      snapshot.subscriptionCandidates.reduce((sum, s) => sum.plus(money(s.estimatedYearlyCostKrw)), money(0))
    )

    // Find a budget covering the category most subscriptions belong to.
    const categoryCounts = new Map<string, number>()
    for (const s of snapshot.subscriptionCandidates) {
      if (!s.categoryName) continue
      categoryCounts.set(s.categoryName, (categoryCounts.get(s.categoryName) ?? 0) + 1)
    }
    const dominantCategory = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const matchingBudget = dominantCategory
      ? snapshot.budgetUsage.find((b) => b.category_name === dominantCategory && b.budgetKrw > 0)
      : undefined

    const overBudgetPct = matchingBudget ? pct(money(monthlyEquivalent).minus(matchingBudget.budgetKrw), matchingBudget.budgetKrw, 0) : null
    const isOverBudget = overBudgetPct !== null && overBudgetPct > 0
    const isSignificant = monthlyEquivalent >= 30_000 || (currentMonth.totalExpenseKrw > 0 && monthlyEquivalent / currentMonth.totalExpenseKrw >= 0.05)

    if (isOverBudget || isSignificant) {
      candidates.push({
        ...base,
        key: 'action:subscriptions',
        role: 'action',
        insight_type: 'subscription_review',
        severity: isOverBudget ? 'warning' : 'info',
        title: isOverBudget
          ? `Subscriptions are ${overBudgetPct}% above the ${dominantCategory} limit`
          : `${snapshot.subscriptionCandidates.length} recurring payments found`,
        summary: isOverBudget
          ? `Recurring payments come to about ${krw(monthlyEquivalent)} a month against a ${krw(matchingBudget!.budgetKrw)} plan for ${dominantCategory}. That is ${krw(yearlyTotal)} a year.`
          : `Recurring payments come to about ${krw(monthlyEquivalent)} a month, or ${krw(yearlyTotal)} a year. Reviewing which ones still earn their place can free up room elsewhere.`,
        evidence: {
          subscriptionCount: snapshot.subscriptionCandidates.length,
          monthlyEquivalentKrw: monthlyEquivalent,
          yearlyTotalKrw: yearlyTotal,
          budgetKrw: matchingBudget?.budgetKrw ?? null,
          budgetCategory: dominantCategory,
          overBudgetPct,
          topSubscriptions: snapshot.subscriptionCandidates.slice(0, 5).map((s) => ({
            name: s.name,
            averageAmountKrw: s.averageAmountKrw,
            frequency: s.frequency,
            yearlyCostKrw: s.estimatedYearlyCostKrw,
            confidence: s.confidence,
          })),
        },
        estimated_monthly_savings_krw: monthlyEquivalent,
        confidence: snapshot.subscriptionCandidates.some((s) => s.confidence === 'high') ? 'high' : 'medium',
        priority: 110 + (isOverBudget ? 30 : 0),
        action: { kind: 'review_subscriptions', label: 'Review subscriptions', href: '/subscriptions' },
      })
    }
  }

  // Frequent small purchases — the classic invisible drain.
  const smallBuckets = snapshot.smallTransactionBuckets.filter((b) => b.maxKrw !== null && b.maxKrw <= 10_000)
  const smallTotal = smallBuckets.reduce((sum, b) => sum + b.totalKrw, 0)
  const smallCount = smallBuckets.reduce((sum, b) => sum + b.count, 0)
  const smallShare = currentMonth.totalExpenseKrw > 0 ? smallTotal / currentMonth.totalExpenseKrw : 0

  if (smallCount >= 5 && (smallTotal >= 50_000 || smallShare >= 0.1)) {
    candidates.push({
      ...base,
      key: 'action:small-purchases',
      role: 'action',
      insight_type: 'small_purchases',
      severity: 'info',
      title: `Frequent small purchases added up to ${krw(smallTotal)} this month`,
      summary: `${smallCount} purchases of ${krw(10_000)} or less came to ${krw(smallTotal)}, about ${pct(smallTotal, currentMonth.totalExpenseKrw, 0)}% of this month's spending.`,
      evidence: {
        smallPurchaseCount: smallCount,
        smallPurchaseTotalKrw: smallTotal,
        sharePct: pct(smallTotal, currentMonth.totalExpenseKrw, 0),
        totalExpenseKrw: currentMonth.totalExpenseKrw,
        buckets: smallBuckets.map((b) => ({ range: b.label, count: b.count, totalKrw: b.totalKrw })),
      },
      estimated_monthly_savings_krw: roundKRW(money(smallTotal).times(0.3)),
      confidence: 'high',
      priority: 90 + smallTotal / 10_000,
      action: { kind: 'view_analytics', label: 'See breakdown', href: '/analytics' },
    })
  }

  // Budget adjustment with the biggest gap between plan and reality.
  if (budgetPlan && budgetPlan.recommendations.length > 0) {
    const actionable = budgetPlan.recommendations
      .filter((r) => r.reason === 'raise_unrealistic' || r.reason === 'gradual_reduction')
      .sort((a, b) => Math.abs(b.changeFromCurrentKrw) - Math.abs(a.changeFromCurrentKrw))[0]

    if (actionable && Math.abs(actionable.changeFromCurrentKrw) >= 10_000) {
      const isReduction = actionable.reason === 'gradual_reduction'
      candidates.push({
        ...base,
        key: `action:budget:${actionable.categoryId}`,
        role: 'action',
        insight_type: 'budget_recommendation',
        severity: 'info',
        title: isReduction
          ? `A ${krw(actionable.recommendedBudgetKrw)} target for ${actionable.categoryName} looks achievable`
          : `${actionable.categoryName}'s budget looks lower than it needs to be`,
        summary: actionable.rationale,
        evidence: {
          category: actionable.categoryName,
          currentBudgetKrw: actionable.currentBudgetKrw,
          recommendedBudgetKrw: actionable.recommendedBudgetKrw,
          averageMonthlyKrw: actionable.averageKrw,
          medianMonthlyKrw: actionable.medianKrw,
          monthsAnalyzed: actionable.monthsOfData,
          changeKrw: actionable.changeFromCurrentKrw,
          spendingClass: actionable.spendingClass,
        },
        estimated_monthly_savings_krw: isReduction ? Math.max(-actionable.changeFromCurrentKrw, 0) : null,
        confidence: actionable.monthsOfData >= 3 ? 'high' : 'medium',
        priority: 80 + Math.abs(actionable.changeFromCurrentKrw) / 10_000,
        action: {
          kind: 'adjust_budget',
          label: 'Review budget change',
          href: '/budget',
          categoryId: actionable.categoryId,
          categoryName: actionable.categoryName,
          currentValueKrw: actionable.currentBudgetKrw,
          proposedValueKrw: actionable.recommendedBudgetKrw,
        },
      })
    }
  }

  // Respect the user's configured spending ceiling, if they set one.
  const limit = preferences.monthly_spending_limit_krw
  if (limit && limit > 0 && dailyPace.isCurrentMonth && dailyPace.projectedEndOfMonthKrw > limit) {
    const over = dailyPace.projectedEndOfMonthKrw - limit
    candidates.push({
      ...base,
      key: 'warning:spending-limit',
      role: 'warning',
      insight_type: 'category_overspend',
      severity: 'warning',
      title: `Projected to pass your ${krw(limit)} monthly limit`,
      summary: `At the current pace this month reaches about ${krw(dailyPace.projectedEndOfMonthKrw)}, ${krw(over)} above the limit you set.`,
      evidence: {
        monthlyLimitKrw: limit,
        projectedSpendingKrw: dailyPace.projectedEndOfMonthKrw,
        overLimitKrw: over,
        daysRemaining: dailyPace.daysRemaining,
      },
      estimated_monthly_savings_krw: over,
      confidence: 'high',
      priority: 150 + over / 1000,
      action: { kind: 'view_analytics', label: 'Review spending', href: '/analytics' },
    })
  }

  return candidates.sort((a, b) => b.priority - a.priority)
}

// At most three cards, and at most one per role, so the dashboard always
// reads as: something good, something to watch, something to do.
export function selectTopInsights(candidates: InsightCandidate[], maxTotal = 3): InsightCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const selected: InsightCandidate[] = []
  const rolesUsed = new Set<InsightRole>()

  for (const role of ['positive', 'warning', 'action'] as InsightRole[]) {
    const best = sorted.find((c) => c.role === role)
    if (best) {
      selected.push(best)
      rolesUsed.add(role)
    }
  }

  return selected.slice(0, maxTotal).sort((a, b) => {
    const order: Record<InsightRole, number> = { positive: 0, warning: 1, action: 2 }
    return order[a.role] - order[b.role]
  })
}
