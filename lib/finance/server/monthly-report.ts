// The single entry point every surface (UI, Telegram cron, email cron, the
// "send test report" action) uses to get a month's report. Loads rows from
// Supabase, then hands them to the pure `computeMonthlyReport` engine so
// every channel renders identical numbers.

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeMonthlyReport, type MonthlyReport } from '@/lib/finance/monthly-report'
import { loadFinanceDataset } from '@/lib/finance/server/data'

function referenceDateForMonth(month: string, now: Date = new Date()): Date {
  const [year, mon] = month.split('-').map(Number)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  // Anchor to "now" for the current month so pace/projection math sees
  // today's date; anchor to the month's last day for any completed month so
  // projections resolve as of that month, not today.
  return month === currentMonthKey ? now : new Date(year, mon, 0)
}

export async function buildMonthlyReport(
  supabase: SupabaseClient,
  userId: string,
  month: string,
  now: Date = new Date()
): Promise<MonthlyReport> {
  const referenceDate = referenceDateForMonth(month, now)
  const dataset = await loadFinanceDataset(supabase, userId, referenceDate)

  return computeMonthlyReport({
    month,
    transactions: dataset.transactions,
    budgets: dataset.budgets,
    savingsGoals: dataset.savingsGoals,
    savingsContributions: dataset.savingsContributions,
    recurringTemplates: dataset.recurringTemplates,
    referenceDate,
  })
}
