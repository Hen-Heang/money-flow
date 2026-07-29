// Monthly financial report (deterministic). This is the single source of
// truth for report content — the UI, the Telegram cron, and the email cron
// all render from the same `MonthlyReport` object so the numbers a user
// sees never disagree between channels.
//
// Two layers, same split as weekly-checkin.ts:
//   - computeMonthlyReport(): pure, takes already-loaded engine data in.
//   - buildMonthlyReport() in lib/finance/server/monthly-report.ts: loads
//     the data from Supabase and calls this.

import {
  money,
  roundKRW,
  pct,
  computePeriodTotals,
  computeCategoryBreakdown,
  computeBudgetUsage,
  computeGoalPlan,
  detectSubscriptionCandidates,
} from '@/lib/finance/analysis'
import type {
  EngineTransaction,
  EngineBudget,
  EngineSavingsGoal,
  EngineSavingsContribution,
  GoalStatus,
  BudgetUsageEntry,
  RecurringTemplateHint,
} from '@/lib/finance/analysis'

export interface MonthlyReportCategory {
  categoryId: string | null
  name: string
  totalKrw: number
  pctOfTotal: number
}

export interface MonthlyReportSavingsGoal {
  goalId: string
  name: string
  status: GoalStatus
  currentUsd: number
  targetUsd: number
  requiredMonthlyUsd: number | null
  plannedMonthlyUsd: number
}

export interface MonthlyReportRecurringItem {
  name: string
  monthlyKrw: number
  frequency: 'monthly' | 'yearly' | 'irregular'
  categoryName: string | null
}

export interface MonthlyReportPreviousMonth {
  month: string
  incomeKrw: number
  expenseKrw: number
  netSavingsKrw: number
  savingsRatePct: number
  incomeDeltaPct: number | null
  expenseDeltaPct: number | null
  netSavingsDeltaKrw: number
  savingsRateDeltaPct: number | null
}

export type MonthlyReportInsightType = 'positive' | 'warning' | 'action'

export interface MonthlyReportInsight {
  type: MonthlyReportInsightType
  message: string
}

export interface MonthlyReport {
  month: string // YYYY-MM
  monthLabel: string // e.g. "July 2026"
  periodStart: string
  periodEnd: string
  isComplete: boolean
  incomeKrw: number
  expenseKrw: number
  netSavingsKrw: number
  savingsRatePct: number
  previousMonth: MonthlyReportPreviousMonth
  topCategories: MonthlyReportCategory[]
  budgetStatus: BudgetUsageEntry[]
  savingsGoals: MonthlyReportSavingsGoal[]
  recurringExpenses: { items: MonthlyReportRecurringItem[]; totalMonthlyKrw: number }
  insights: { positive: MonthlyReportInsight; warning: MonthlyReportInsight; action: MonthlyReportInsight }
  hasActivity: boolean
}

export interface BuildMonthlyReportInput {
  month: string // YYYY-MM
  transactions: EngineTransaction[]
  budgets: EngineBudget[]
  savingsGoals: EngineSavingsGoal[]
  savingsContributions: EngineSavingsContribution[]
  recurringTemplates: RecurringTemplateHint[]
  referenceDate?: Date
}

function monthKeyParts(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split('-').map(Number)
  return { year, month }
}

export function monthBounds(monthKey: string): { start: string; end: string; endExclusive: string } {
  const { year, month } = monthKeyParts(monthKey)
  const lastDay = new Date(year, month, 0).getDate()
  const start = `${monthKey}-01`
  const end = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  const endExclusive = new Date(year, month, 1).toISOString().slice(0, 10)
  return { start, end, endExclusive }
}

export function previousMonthKey(monthKey: string): string {
  const { year, month } = monthKeyParts(monthKey)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey: string): string {
  const { year, month } = monthKeyParts(monthKey)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Resolves the most recently *completed* calendar month for a user in their
 * own timezone. Always the calendar month before whatever "today" is
 * locally — well-defined on every day of the month, so a daily cron check
 * naturally waits until a month has fully elapsed for that specific user
 * before it becomes eligible, regardless of where they are in the world.
 */
export function resolveTargetReportMonth(now: Date, timezone: string): string {
  let year: number
  let month: number // 1-indexed
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now)
    year = Number(parts.find((p) => p.type === 'year')?.value)
    month = Number(parts.find((p) => p.type === 'month')?.value)
    if (!Number.isFinite(year) || !Number.isFinite(month)) throw new Error('invalid parts')
  } catch {
    // An invalid timezone must not crash the cron — fall back to UTC.
    year = now.getUTCFullYear()
    month = now.getUTCMonth() + 1
  }

  let targetYear = year
  let targetMonth = month - 1
  if (targetMonth === 0) {
    targetMonth = 12
    targetYear -= 1
  }
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}`
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return pct(money(current).minus(previous), previous)
}

// Normalizes a detected subscription candidate to a single monthly cost
// figure, whatever its actual billing cadence is.
function monthlyKrwFor(estimatedYearlyCostKrw: number): number {
  return roundKRW(money(estimatedYearlyCostKrw).dividedBy(12))
}

function buildInsights(data: {
  currentExpenseKrw: number
  currentIncomeKrw: number
  savingsRatePct: number
  previousMonth: MonthlyReportPreviousMonth
  topCategories: MonthlyReportCategory[]
  budgetStatus: BudgetUsageEntry[]
  savingsGoals: MonthlyReportSavingsGoal[]
  recurringTotalKrw: number
  transactionCount: number
}): MonthlyReport['insights'] {
  const overBudget = data.budgetStatus.filter((b) => b.overBudget).sort((a, b) => b.spentKrw - b.budgetKrw - (a.spentKrw - a.budgetKrw))[0]
  const behindGoal = data.savingsGoals.find((g) => g.status === 'off_track' || g.status === 'at_risk')
  const noBudgetTop = data.topCategories.find(
    (c) => c.categoryId && !data.budgetStatus.some((b) => b.category_id === c.categoryId)
  )

  // ── Positive ──────────────────────────────────────────────────────────
  let positive: MonthlyReportInsight
  if (data.previousMonth.savingsRateDeltaPct !== null && data.previousMonth.savingsRateDeltaPct > 0) {
    positive = {
      type: 'positive',
      message: `Your savings rate rose to ${data.savingsRatePct}% this month, up from ${data.previousMonth.savingsRatePct}% in ${monthLabel(data.previousMonth.month)}.`,
    }
  } else if (data.budgetStatus.length > 0 && overBudget === undefined) {
    positive = {
      type: 'positive',
      message: `Every budgeted category stayed within its plan this month — ${data.budgetStatus.length} for ${data.budgetStatus.length === 1 ? 'category' : 'categories'} on track.`,
    }
  } else if (data.previousMonth.expenseDeltaPct !== null && data.previousMonth.expenseDeltaPct < 0) {
    positive = {
      type: 'positive',
      message: `Spending fell ${Math.abs(data.previousMonth.expenseDeltaPct)}% compared to ${monthLabel(data.previousMonth.month)}.`,
    }
  } else {
    positive = {
      type: 'positive',
      message:
        data.transactionCount > 0
          ? `You logged ${data.transactionCount} transactions this month — that visibility is what makes the rest of this report possible.`
          : 'A fresh month to build a clear spending picture from.',
    }
  }

  // ── Warning ───────────────────────────────────────────────────────────
  let warning: MonthlyReportInsight
  if (overBudget) {
    const overKrw = overBudget.spentKrw - overBudget.budgetKrw
    warning = {
      type: 'warning',
      message: `${overBudget.category_name} went ₩${overKrw.toLocaleString('en-US')} over its ₩${overBudget.budgetKrw.toLocaleString('en-US')} budget.`,
    }
  } else if (data.previousMonth.savingsRateDeltaPct !== null && data.previousMonth.savingsRateDeltaPct < -5) {
    warning = {
      type: 'warning',
      message: `Your savings rate fell to ${data.savingsRatePct}% from ${data.previousMonth.savingsRatePct}% in ${monthLabel(data.previousMonth.month)}.`,
    }
  } else if (behindGoal) {
    warning = {
      type: 'warning',
      message: `${behindGoal.name} is behind schedule to reach its goal by the deadline.`,
    }
  } else if (data.currentExpenseKrw > data.currentIncomeKrw && data.currentIncomeKrw > 0) {
    warning = {
      type: 'warning',
      message: `You spent more than you earned this month (₩${(data.currentExpenseKrw - data.currentIncomeKrw).toLocaleString('en-US')} over income).`,
    }
  } else {
    warning = {
      type: 'warning',
      message: 'Nothing stood out as a concern this month — worth keeping an eye on categories closest to their budget.',
    }
  }

  // ── Action ────────────────────────────────────────────────────────────
  let action: MonthlyReportInsight
  if (overBudget) {
    action = {
      type: 'action',
      message: `Consider trimming ${overBudget.category_name} spending for the first part of next month to offset the overage.`,
    }
  } else if (noBudgetTop) {
    action = {
      type: 'action',
      message: `${noBudgetTop.name} was a top category with no budget set — adding one would make next month easier to steer.`,
    }
  } else if (behindGoal && behindGoal.requiredMonthlyUsd !== null && behindGoal.requiredMonthlyUsd > behindGoal.plannedMonthlyUsd) {
    action = {
      type: 'action',
      message: `Raising ${behindGoal.name}'s monthly contribution to $${behindGoal.requiredMonthlyUsd.toLocaleString('en-US')} would put it back on track.`,
    }
  } else if (data.recurringTotalKrw > 0 && data.currentIncomeKrw > 0 && data.recurringTotalKrw / data.currentIncomeKrw > 0.15) {
    action = {
      type: 'action',
      message: `Recurring charges are about ₩${data.recurringTotalKrw.toLocaleString('en-US')}/month — worth a quick review for anything unused.`,
    }
  } else {
    action = {
      type: 'action',
      message: 'Keep logging transactions as they happen — it keeps every future report this accurate.',
    }
  }

  return { positive, warning, action }
}

export function computeMonthlyReport(input: BuildMonthlyReportInput): MonthlyReport {
  const referenceDate = input.referenceDate ?? new Date()
  const current = monthBounds(input.month)
  const prevMonthKey = previousMonthKey(input.month)
  const previous = monthBounds(prevMonthKey)

  const currentTx = input.transactions.filter((t) => t.date >= current.start && t.date <= current.end)

  const currentTotals = computePeriodTotals(input.transactions, current.start, current.end)
  const previousTotals = computePeriodTotals(input.transactions, previous.start, previous.end)

  const previousMonth: MonthlyReportPreviousMonth = {
    month: prevMonthKey,
    incomeKrw: previousTotals.totalIncomeKrw,
    expenseKrw: previousTotals.totalExpenseKrw,
    netSavingsKrw: previousTotals.netCashFlowKrw,
    savingsRatePct: previousTotals.savingsRatePct,
    incomeDeltaPct: deltaPct(currentTotals.totalIncomeKrw, previousTotals.totalIncomeKrw),
    expenseDeltaPct: deltaPct(currentTotals.totalExpenseKrw, previousTotals.totalExpenseKrw),
    netSavingsDeltaKrw: roundKRW(money(currentTotals.netCashFlowKrw).minus(previousTotals.netCashFlowKrw)),
    savingsRateDeltaPct:
      previousTotals.totalIncomeKrw === 0 ? null : currentTotals.savingsRatePct - previousTotals.savingsRatePct,
  }

  const topCategories: MonthlyReportCategory[] = computeCategoryBreakdown(currentTx)
    .slice(0, 3)
    .map((c) => ({ categoryId: c.category_id, name: c.category_name, totalKrw: c.totalKrw, pctOfTotal: c.pctOfTotal }))

  const budgetStatus = computeBudgetUsage(input.transactions, input.budgets, current.start, current.endExclusive)

  const savingsGoals: MonthlyReportSavingsGoal[] = input.savingsGoals.map((goal) => {
    const plan = computeGoalPlan(goal, input.savingsContributions, referenceDate)
    return {
      goalId: plan.goalId,
      name: plan.name,
      status: plan.status,
      currentUsd: plan.currentUsd,
      targetUsd: plan.targetUsd,
      requiredMonthlyUsd: plan.requiredMonthlyUsd,
      plannedMonthlyUsd: plan.currentPlannedMonthlyUsd,
    }
  })

  const subscriptionCandidates = detectSubscriptionCandidates(input.transactions, input.recurringTemplates)
  const recurringItems: MonthlyReportRecurringItem[] = subscriptionCandidates.map((s) => ({
    name: s.name,
    monthlyKrw: monthlyKrwFor(s.estimatedYearlyCostKrw),
    frequency: s.frequency,
    categoryName: s.categoryName,
  }))
  const recurringTotalKrw = roundKRW(recurringItems.reduce((sum, r) => sum + r.monthlyKrw, 0))

  const hasActivity = currentTotals.totalIncomeKrw > 0 || currentTotals.totalExpenseKrw > 0

  const insights = buildInsights({
    currentExpenseKrw: currentTotals.totalExpenseKrw,
    currentIncomeKrw: currentTotals.totalIncomeKrw,
    savingsRatePct: currentTotals.savingsRatePct,
    previousMonth,
    topCategories,
    budgetStatus,
    savingsGoals,
    recurringTotalKrw,
    transactionCount: currentTotals.transactionCount,
  })

  const currentMonthKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`

  return {
    month: input.month,
    monthLabel: monthLabel(input.month),
    periodStart: current.start,
    periodEnd: current.end,
    isComplete: input.month < currentMonthKey,
    incomeKrw: currentTotals.totalIncomeKrw,
    expenseKrw: currentTotals.totalExpenseKrw,
    netSavingsKrw: currentTotals.netCashFlowKrw,
    savingsRatePct: currentTotals.savingsRatePct,
    previousMonth,
    topCategories,
    budgetStatus,
    savingsGoals,
    recurringExpenses: { items: recurringItems, totalMonthlyKrw: recurringTotalKrw },
    insights,
    hasActivity,
  }
}

function krw(value: number): string {
  return `₩${Math.round(value).toLocaleString('en-US')}`
}

// Telegram-flavoured rendering (HTML parse mode), matching the style of
// lib/finance/weekly-checkin.ts. `reviewUrl` links to the full monthly
// review screen in the app.
export function renderMonthlyReportTelegramMessage(
  report: MonthlyReport,
  escapeHtml: (s: string) => string,
  reviewUrl: string
): string {
  const trend =
    report.previousMonth.expenseDeltaPct === null
      ? ''
      : report.previousMonth.expenseDeltaPct > 0
        ? ` ↑${report.previousMonth.expenseDeltaPct}% vs ${monthLabel(report.previousMonth.month)}`
        : report.previousMonth.expenseDeltaPct < 0
          ? ` ↓${Math.abs(report.previousMonth.expenseDeltaPct)}% vs ${monthLabel(report.previousMonth.month)}`
          : ` same as ${monthLabel(report.previousMonth.month)}`

  const lines = [
    `📅 <b>${escapeHtml(report.monthLabel)} report</b>`,
    '',
    report.incomeKrw > 0 ? `📈 Income: ${krw(report.incomeKrw)}` : '',
    `📉 Spent: ${krw(report.expenseKrw)}${trend}`,
    `💰 Net: ${krw(report.netSavingsKrw)} (${report.savingsRatePct}% savings rate)`,
  ]

  if (report.topCategories.length > 0) {
    lines.push('', '<b>Top categories</b>')
    for (const category of report.topCategories) {
      lines.push(`  • ${escapeHtml(category.name)}: ${krw(category.totalKrw)}`)
    }
  }

  const budgeted = report.budgetStatus.filter((b) => b.budgetKrw > 0)
  if (budgeted.length > 0) {
    lines.push('', '<b>Budget status</b>')
    for (const budget of budgeted.slice(0, 5)) {
      const marker = budget.overBudget ? '⚠️' : budget.usagePct >= 70 ? '🟡' : '🟢'
      lines.push(`  ${marker} ${escapeHtml(budget.category_name)}: ${Math.round(budget.usagePct)}%`)
    }
  }

  if (report.savingsGoals.length > 0) {
    lines.push('', '<b>Savings goals</b>')
    for (const goal of report.savingsGoals.slice(0, 3)) {
      lines.push(`  • ${escapeHtml(goal.name)}: $${goal.currentUsd.toLocaleString('en-US')} / $${goal.targetUsd.toLocaleString('en-US')}`)
    }
  }

  if (report.recurringExpenses.items.length > 0) {
    lines.push('', `<b>Recurring:</b> ${krw(report.recurringExpenses.totalMonthlyKrw)}/month across ${report.recurringExpenses.items.length} items`)
  }

  lines.push(
    '',
    `✅ ${escapeHtml(report.insights.positive.message)}`,
    `⚠️ ${escapeHtml(report.insights.warning.message)}`,
    `💡 ${escapeHtml(report.insights.action.message)}`
  )

  lines.push('', `🔗 <a href="${reviewUrl}">View the full monthly review</a>`)

  return lines.filter((line) => line !== undefined).join('\n')
}
