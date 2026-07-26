// Weekly check-in content (Feature 8). Deterministic — builds the whole
// message from engine output so the numbers in a notification always match
// what the app shows.

import { money, sumMoney, roundKRW, pct } from '@/lib/finance/analysis'
import type { EngineTransaction, EngineBudget, EngineSavingsGoal, EngineSavingsContribution } from '@/lib/finance/analysis'
import { computeCategoryBreakdown, computeBudgetUsage, detectUnusualTransactions, computeGoalPlan } from '@/lib/finance/analysis'

export interface WeeklyCheckIn {
  weekStart: string
  weekEnd: string
  incomeKrw: number
  expenseKrw: number
  previousExpenseKrw: number
  changePct: number | null
  topCategories: Array<{ name: string; totalKrw: number }>
  budgetProgress: Array<{ category: string; usagePct: number; overBudget: boolean }>
  unusualExpenses: Array<{ description: string; amountKrw: number }>
  savingsProgress: Array<{ name: string; currentUsd: number; targetUsd: number; status: string }>
  suggestedAction: string
}

export interface BuildWeeklyCheckInInput {
  transactions: EngineTransaction[]
  budgets: EngineBudget[]
  savingsGoals: EngineSavingsGoal[]
  savingsContributions: EngineSavingsContribution[]
  referenceDate?: Date
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function krw(value: number): string {
  return `₩${Math.round(value).toLocaleString('en-US')}`
}

// Exactly one concrete, achievable action — never a list the user has to
// triage themselves.
function buildSuggestedAction(data: Omit<WeeklyCheckIn, 'suggestedAction'>): string {
  const overBudget = data.budgetProgress.find((b) => b.overBudget)
  if (overBudget) {
    return `${overBudget.category} has passed its monthly plan. Try pausing non-essential spending there for the next few days.`
  }

  const nearLimit = data.budgetProgress.find((b) => b.usagePct >= 70 && b.usagePct < 100)
  if (nearLimit) {
    return `${nearLimit.category} is at ${nearLimit.usagePct}% of its plan. Keeping it steady this week should bring the month in on target.`
  }

  if (data.unusualExpenses.length > 0) {
    const unusual = data.unusualExpenses[0]
    return `One larger expense stood out this week (${unusual.description}, ${krw(unusual.amountKrw)}). Worth a quick check that it was expected.`
  }

  const behindGoal = data.savingsProgress.find((g) => g.status === 'at_risk' || g.status === 'off_track')
  if (behindGoal) {
    return `${behindGoal.name} is behind schedule. Setting a monthly contribution in the app would put it back on track.`
  }

  if (data.topCategories.length > 0) {
    const top = data.topCategories[0]
    return `${top.name} was your largest category this week at ${krw(top.totalKrw)}. Setting a budget for it would make next week easier to steer.`
  }

  return 'Nothing needs attention this week. Logging transactions as they happen keeps next week just as clear.'
}

export function buildWeeklyCheckIn(input: BuildWeeklyCheckInInput): WeeklyCheckIn {
  const referenceDate = input.referenceDate ?? new Date()

  // The week just finished: D-7 through yesterday.
  const weekEnd = isoDate(shiftDays(referenceDate, -1))
  const weekStart = isoDate(shiftDays(referenceDate, -7))
  const prevEnd = isoDate(shiftDays(referenceDate, -8))
  const prevStart = isoDate(shiftDays(referenceDate, -14))

  const thisWeek = input.transactions.filter((t) => t.date >= weekStart && t.date <= weekEnd)
  const prevWeek = input.transactions.filter((t) => t.date >= prevStart && t.date <= prevEnd)

  const incomeKrw = roundKRW(sumMoney(thisWeek.filter((t) => t.type === 'income').map((t) => t.amount_krw)))
  const expenseKrw = roundKRW(sumMoney(thisWeek.filter((t) => t.type === 'expense').map((t) => t.amount_krw)))
  const previousExpenseKrw = roundKRW(sumMoney(prevWeek.filter((t) => t.type === 'expense').map((t) => t.amount_krw)))

  const monthStart = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-01`
  const monthEndExclusive = isoDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1))

  const budgetUsage = computeBudgetUsage(input.transactions, input.budgets, monthStart, monthEndExclusive)

  const partial: Omit<WeeklyCheckIn, 'suggestedAction'> = {
    weekStart,
    weekEnd,
    incomeKrw,
    expenseKrw,
    previousExpenseKrw,
    changePct: previousExpenseKrw === 0 ? null : pct(money(expenseKrw).minus(previousExpenseKrw), previousExpenseKrw, 0),
    topCategories: computeCategoryBreakdown(thisWeek)
      .slice(0, 3)
      .map((c) => ({ name: c.category_name, totalKrw: c.totalKrw })),
    budgetProgress: budgetUsage
      .filter((b) => b.budgetKrw > 0)
      .sort((a, b) => b.usagePct - a.usagePct)
      .slice(0, 3)
      .map((b) => ({ category: b.category_name, usagePct: Math.round(b.usagePct), overBudget: b.overBudget })),
    unusualExpenses: detectUnusualTransactions(thisWeek)
      .slice(0, 2)
      .map((u) => ({ description: u.description, amountKrw: u.amountKrw })),
    savingsProgress: input.savingsGoals.slice(0, 3).map((goal) => {
      const plan = computeGoalPlan(goal, input.savingsContributions, referenceDate)
      return { name: plan.name, currentUsd: plan.currentUsd, targetUsd: plan.targetUsd, status: plan.status }
    }),
  }

  return { ...partial, suggestedAction: buildSuggestedAction(partial) }
}

// Telegram-flavoured rendering (HTML parse mode), matching the existing
// notification style in lib/telegram.ts.
export function renderWeeklyCheckInMessage(checkIn: WeeklyCheckIn, escapeHtml: (s: string) => string): string {
  const trend =
    checkIn.changePct === null
      ? ''
      : checkIn.changePct > 0
        ? ` ↑${checkIn.changePct}% vs last week`
        : checkIn.changePct < 0
          ? ` ↓${Math.abs(checkIn.changePct)}% vs last week`
          : ' same as last week'

  const lines = [
    '📊 <b>Weekly check-in</b>',
    '',
    `📉 Spent: ${krw(checkIn.expenseKrw)}${trend}`,
    checkIn.incomeKrw > 0 ? `📈 Received: ${krw(checkIn.incomeKrw)}` : '',
  ]

  if (checkIn.topCategories.length > 0) {
    lines.push('', '<b>Top categories</b>')
    for (const category of checkIn.topCategories) {
      lines.push(`  • ${escapeHtml(category.name)}: ${krw(category.totalKrw)}`)
    }
  }

  if (checkIn.budgetProgress.length > 0) {
    lines.push('', '<b>Budget progress</b>')
    for (const budget of checkIn.budgetProgress) {
      const marker = budget.overBudget ? '⚠️' : budget.usagePct >= 70 ? '🟡' : '🟢'
      lines.push(`  ${marker} ${escapeHtml(budget.category)}: ${budget.usagePct}%`)
    }
  }

  if (checkIn.unusualExpenses.length > 0) {
    lines.push('', '<b>Stood out</b>')
    for (const expense of checkIn.unusualExpenses) {
      lines.push(`  • ${escapeHtml(expense.description)}: ${krw(expense.amountKrw)}`)
    }
  }

  if (checkIn.savingsProgress.length > 0) {
    lines.push('', '<b>Savings</b>')
    for (const goal of checkIn.savingsProgress) {
      lines.push(`  • ${escapeHtml(goal.name)}: $${goal.currentUsd.toLocaleString('en-US')} / $${goal.targetUsd.toLocaleString('en-US')}`)
    }
  }

  lines.push('', `💡 <b>This week:</b> ${escapeHtml(checkIn.suggestedAction)}`)

  return lines.filter((line) => line !== undefined).join('\n')
}

// Quiet hours are stored as HH:MM in the user's timezone and may wrap past
// midnight (e.g. 22:00 → 08:00).
export function isWithinQuietHours(
  quietHours: { enabled: boolean; start: string; end: string; timezone: string },
  now: Date = new Date()
): boolean {
  if (!quietHours.enabled) return false

  let localTime: string
  try {
    localTime = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: quietHours.timezone,
    }).format(now)
  } catch {
    // An invalid timezone must not silence notifications entirely.
    return false
  }

  const { start, end } = quietHours
  if (start === end) return false
  if (start < end) return localTime >= start && localTime < end
  // Window wraps midnight.
  return localTime >= start || localTime < end
}
