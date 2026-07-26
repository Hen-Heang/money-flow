// Shared formatting for insight evidence, used by the dashboard coach and
// the monthly review. Keeps the "show your work" panel readable without
// dumping raw JSON at the user.

import { formatKRW } from '@/lib/utils'

const LABELS: Record<string, string> = {
  spentKrw: 'Spent so far',
  budgetKrw: 'Budget',
  projectedKrw: 'Projected',
  overshootKrw: 'Over by',
  usagePct: 'Budget used',
  daysPassed: 'Days elapsed',
  daysRemaining: 'Days left',
  currentSavingsRatePct: 'Savings rate now',
  previousSavingsRatePct: 'Last month',
  improvementPoints: 'Improvement',
  currentNetCashFlowKrw: 'Net this month',
  currentExpenseKrw: 'This month',
  previousExpenseKrw: 'Last month',
  differenceKrw: 'Difference',
  changePct: 'Change',
  monthlyEquivalentKrw: 'Monthly cost',
  yearlyTotalKrw: 'Yearly cost',
  subscriptionCount: 'Recurring payments',
  overBudgetPct: 'Above plan',
  budgetCategory: 'Category',
  smallPurchaseCount: 'Small purchases',
  smallPurchaseTotalKrw: 'Total',
  sharePct: 'Share of spending',
  totalExpenseKrw: 'Total spending',
  requiredMonthlyUsd: 'Needed each month',
  plannedMonthlyUsd: 'Planned each month',
  shortfallUsd: 'Shortfall',
  monthlyRateUsd: 'Current rate',
  targetUsd: 'Target',
  currentUsd: 'Saved',
  remainingUsd: 'Remaining',
  surplusUsd: 'Above target',
  deadline: 'Deadline',
  monthsRemaining: 'Months left',
  projectedCompletionDate: 'Projected completion',
  currentBudgetKrw: 'Current budget',
  recommendedBudgetKrw: 'Suggested budget',
  averageMonthlyKrw: 'Monthly average',
  medianMonthlyKrw: 'Typical month',
  monthsAnalyzed: 'Months analysed',
  changeKrw: 'Change',
  spendingClass: 'Category type',
  projectedSpendingKrw: 'Projected spending',
  incomeBaselineKrw: 'Typical income',
  excessKrw: 'Above income',
  monthsOfIncomeData: 'Months of income data',
  monthlyLimitKrw: 'Your limit',
  overLimitKrw: 'Above limit',
  duplicateCount: 'Possible duplicates',
  totalAmountKrw: 'Total amount',
  sampleDescription: 'Example',
  sampleAmountKrw: 'Amount',
  sampleDate: 'Date',
  description: 'Transaction',
  amountKrw: 'Amount',
  category: 'Category',
  date: 'Date',
  unusualCount: 'Unusual expenses',
  goalName: 'Goal',
  status: 'Status',
}

// Internal plumbing that should never surface in the UI.
const HIDDEN_KEYS = new Set(['insightKey', 'role', 'action', 'topSubscriptions', 'buckets', 'goalNames', 'basedOnPartialData'])

export interface EvidenceEntry {
  key: string
  label: string
  value: string
}

function humanize(key: string): string {
  return key
    .replace(/Krw$|Usd$|Pct$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    if (key.endsWith('Krw')) return formatKRW(value)
    if (key.endsWith('Usd')) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    if (key.endsWith('Pct') || key === 'improvementPoints') return `${value}%`
    return value.toLocaleString('en-US')
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value
  return null
}

export function formatEvidenceEntries(evidence: Record<string, unknown>, limit = 6): EvidenceEntry[] {
  const entries: EvidenceEntry[] = []

  for (const [key, value] of Object.entries(evidence ?? {})) {
    if (HIDDEN_KEYS.has(key)) continue
    const formatted = formatValue(key, value)
    if (formatted === null) continue
    entries.push({ key, label: LABELS[key] ?? humanize(key), value: formatted })
    if (entries.length >= limit) break
  }

  return entries
}

export function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  const start = new Date(`${periodStart}T00:00:00`)
  const end = new Date(`${periodEnd}T00:00:00`)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()

  if (sameMonth) {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Early signal',
}
