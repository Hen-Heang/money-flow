import { NextResponse } from 'next/server'
import {
  buildFinancialSnapshot,
  buildBudgetPlan,
  computePeriodTotals,
  computeCategoryBreakdown,
  computeCategoryComparison,
  findBestImprovement,
  findBiggestIncrease,
  computeGoalPlan,
  detectSubscriptionCandidates,
} from '@/lib/finance/analysis'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loadFinanceDataset, loadFinancialPreferences } from '@/lib/finance/server/data'

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

// Full month-end review (Feature 9). Read-only — accepting the proposed
// plan is a separate, explicitly-confirmed write.
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const monthParam = url.searchParams.get('month') // YYYY-MM

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (monthParam) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
    }
    const [y, m] = monthParam.split('-').map(Number)
    year = y
    month = m
  }

  try {
    // Anchor the engine to the reviewed month so pace and projections are
    // computed for that month, not today.
    const referenceDate = year === now.getFullYear() && month === now.getMonth() + 1
      ? now
      : new Date(year, month, 0)

    const [dataset, preferences] = await Promise.all([
      loadFinanceDataset(supabase, user.id, referenceDate),
      loadFinancialPreferences(supabase, user.id),
    ])

    const current = monthBounds(year, month)
    const previousDate = new Date(year, month - 2, 1)
    const previous = monthBounds(previousDate.getFullYear(), previousDate.getMonth() + 1)

    const currentTotals = computePeriodTotals(dataset.transactions, current.start, current.end)
    const previousTotals = computePeriodTotals(dataset.transactions, previous.start, previous.end)

    const currentTx = dataset.transactions.filter((t) => t.date >= current.start && t.date <= current.end)
    const previousTx = dataset.transactions.filter((t) => t.date >= previous.start && t.date <= previous.end)

    const comparison = computeCategoryComparison(
      computeCategoryBreakdown(currentTx),
      computeCategoryBreakdown(previousTx)
    )

    const snapshot = buildFinancialSnapshot({
      transactions: dataset.transactions,
      budgets: dataset.budgets,
      savingsGoals: dataset.savingsGoals,
      savingsContributions: dataset.savingsContributions,
      recurringTemplates: dataset.recurringTemplates,
      referenceDate,
    })

    const budgetPlan = buildBudgetPlan({
      transactions: dataset.transactions,
      budgets: dataset.budgets,
      classifications: dataset.classifications,
      incomeBaselineKrw: snapshot.incomeBaseline.conservativeBaselineKrw,
      targetSavingsRatePct: preferences.target_savings_rate,
      referenceDate,
    })

    const subscriptions = detectSubscriptionCandidates(dataset.transactions, dataset.recurringTemplates)
    const subscriptionYearlyKrw = subscriptions.reduce((sum, s) => sum + s.estimatedYearlyCostKrw, 0)

    // Budget performance for the reviewed month specifically.
    const spentByCategory = new Map<string, number>()
    for (const t of currentTx) {
      if (t.type !== 'expense' || !t.category_id) continue
      spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + t.amount_krw)
    }
    const budgetPerformance = dataset.budgets.map((b) => {
      const spent = Math.round(spentByCategory.get(b.category_id) ?? 0)
      return {
        categoryId: b.category_id,
        categoryName: b.category_name,
        budgetKrw: b.amount_krw,
        spentKrw: spent,
        remainingKrw: b.amount_krw - spent,
        usagePct: b.amount_krw > 0 ? Math.round((spent / b.amount_krw) * 1000) / 10 : 0,
        overBudget: spent > b.amount_krw,
      }
    }).sort((a, b) => b.usagePct - a.usagePct)

    return NextResponse.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      periodStart: current.start,
      periodEnd: current.end,
      totals: currentTotals,
      previousTotals,
      categoryComparison: comparison,
      bestImprovement: findBestImprovement(comparison),
      biggestIncrease: findBiggestIncrease(comparison),
      budgetPerformance,
      subscriptions: {
        count: subscriptions.length,
        monthlyKrw: Math.round(subscriptionYearlyKrw / 12),
        yearlyKrw: subscriptionYearlyKrw,
      },
      goalProgress: dataset.savingsGoals.map((goal) => {
        const plan = computeGoalPlan(goal, dataset.savingsContributions, referenceDate)
        return {
          name: plan.name,
          targetUsd: plan.targetUsd,
          currentUsd: plan.currentUsd,
          remainingUsd: plan.remainingUsd,
          status: plan.status,
          requiredMonthlyUsd: plan.requiredMonthlyUsd,
          plannedMonthlyUsd: plan.currentPlannedMonthlyUsd,
        }
      }),
      nextMonthPlan: budgetPlan,
      incomeBaseline: snapshot.incomeBaseline,
    })
  } catch (error) {
    console.error('[api/finance/monthly-review] Load failed:', error)
    return NextResponse.json({ error: 'Could not build the monthly review' }, { status: 500 })
  }
}
