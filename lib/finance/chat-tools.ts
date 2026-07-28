// Server-side chat tools (Feature 7). Every figure these return is computed
// by the deterministic engine — the model may quote them but must never
// calculate its own.

import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFinancialSnapshot,
  buildBudgetPlan,
  computePeriodTotals,
  computeCategoryBreakdown,
  computeCategoryMonthlySpend,
  simulateBudgetChange,
  detectSubscriptionCandidates,
  computeGoalPlan,
  getLastCompleteMonths,
  toAISafePayload,
} from '@/lib/finance/analysis'
import type { FinanceDataset } from '@/lib/finance/server/data'
import { loadFinanceDataset, loadFinancialPreferences } from '@/lib/finance/server/data'
import type { AIFinancialInsight } from '@/lib/types'

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const monthString = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM')

function monthBounds(month: string): { start: string; end: string } {
  const [year, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const lastDay = new Date(year, m, 0).getDate()
  return { start, end: `${month}-${String(lastDay).padStart(2, '0')}` }
}

// The dataset is loaded once per chat request and shared by every tool call,
// so a multi-step conversation doesn't re-query on each step.
export function createFinanceChatTools(supabase: SupabaseClient, userId: string, referenceDate = new Date()) {
  let datasetPromise: Promise<FinanceDataset> | null = null

  const getDataset = () => {
    datasetPromise ??= loadFinanceDataset(supabase, userId, referenceDate)
    return datasetPromise
  }

  const getSnapshot = async () => {
    const dataset = await getDataset()
    return buildFinancialSnapshot({
      transactions: dataset.transactions,
      budgets: dataset.budgets,
      savingsGoals: dataset.savingsGoals,
      savingsContributions: dataset.savingsContributions,
      recurringTemplates: dataset.recurringTemplates,
      referenceDate,
    })
  }

  return {
    getFinancialSummary: tool({
      description:
        'Get the verified financial snapshot for the current month: income, expenses, net cash flow, savings rate, top categories, spending pace, budget usage, and goal progress. Use this for any general "how am I doing" question.',
      inputSchema: z.object({}),
      execute: async () => toAISafePayload(await getSnapshot()),
    }),

    compareMonths: tool({
      description:
        'Compare two months side by side (income, expenses, net, savings rate, and spending by category). Use for "compare this month with last month" style questions.',
      inputSchema: z.object({
        monthA: monthString.describe('First month, e.g. 2026-06'),
        monthB: monthString.describe('Second month, e.g. 2026-07'),
      }),
      execute: async ({ monthA, monthB }) => {
        const dataset = await getDataset()
        const boundsA = monthBounds(monthA)
        const boundsB = monthBounds(monthB)

        const totalsA = computePeriodTotals(dataset.transactions, boundsA.start, boundsA.end)
        const totalsB = computePeriodTotals(dataset.transactions, boundsB.start, boundsB.end)
        const inA = dataset.transactions.filter((t) => t.date >= boundsA.start && t.date <= boundsA.end)
        const inB = dataset.transactions.filter((t) => t.date >= boundsB.start && t.date <= boundsB.end)

        return {
          [monthA]: {
            ...totalsA,
            topCategories: computeCategoryBreakdown(inA).slice(0, 5).map((c) => ({ category: c.category_name, totalKrw: c.totalKrw })),
          },
          [monthB]: {
            ...totalsB,
            topCategories: computeCategoryBreakdown(inB).slice(0, 5).map((c) => ({ category: c.category_name, totalKrw: c.totalKrw })),
          },
          expenseDifferenceKrw: totalsB.totalExpenseKrw - totalsA.totalExpenseKrw,
          savingsRateDifferencePoints: Number((totalsB.savingsRatePct - totalsA.savingsRatePct).toFixed(1)),
        }
      },
    }),

    getCategorySpending: tool({
      description:
        'Get spending broken down by category for a date range, including each category\'s share of total spending. Use for "where did my money go" or "how much did I spend on X".',
      inputSchema: z.object({
        from: dateString.optional().describe('Start date, inclusive. Defaults to the start of the current month.'),
        to: dateString.optional().describe('End date, inclusive. Defaults to today.'),
        categoryName: z.string().max(100).optional().describe('Optional filter to one category (case-insensitive).'),
      }),
      execute: async ({ from, to, categoryName }) => {
        const dataset = await getDataset()
        const start = from ?? `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-01`
        const end = to ?? referenceDate.toISOString().slice(0, 10)

        const inRange = dataset.transactions.filter((t) => t.date >= start && t.date <= end)
        let breakdown = computeCategoryBreakdown(inRange)

        if (categoryName) {
          const needle = categoryName.toLowerCase()
          breakdown = breakdown.filter((c) => c.category_name.toLowerCase().includes(needle))
        }

        return {
          from: start,
          to: end,
          categories: breakdown.map((c) => ({
            category: c.category_name,
            totalKrw: c.totalKrw,
            pctOfTotal: c.pctOfTotal,
            transactionCount: c.transactionCount,
          })),
        }
      },
    }),

    getBudgetStatus: tool({
      description:
        'Get every budget with month-to-date spending, percent used, remaining amount, and whether the current pace will exceed it. Use for "am I over budget" or "how much can I safely spend".',
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await getSnapshot()
        const { dailyPace } = snapshot

        const budgets = snapshot.budgetUsage.map((usage) => {
          const projected = dailyPace.isCurrentMonth && dailyPace.daysPassed > 0
            ? Math.round((usage.spentKrw / dailyPace.daysPassed) * dailyPace.daysInMonth)
            : usage.spentKrw
          return {
            category: usage.category_name,
            budgetKrw: usage.budgetKrw,
            spentKrw: usage.spentKrw,
            remainingKrw: usage.remainingKrw,
            usagePct: usage.usagePct,
            overBudget: usage.overBudget,
            projectedEndOfMonthKrw: projected,
            onPaceToExceed: projected > usage.budgetKrw,
          }
        })

        const totalBudget = budgets.reduce((sum, b) => sum + b.budgetKrw, 0)
        const totalSpent = budgets.reduce((sum, b) => sum + b.spentKrw, 0)
        const remaining = totalBudget - totalSpent

        return {
          budgets,
          totalBudgetKrw: totalBudget,
          totalSpentKrw: totalSpent,
          totalRemainingKrw: remaining,
          daysRemaining: dailyPace.daysRemaining,
          // The headline number for "how much can I spend for the rest of the month".
          safeDailySpendKrw: dailyPace.daysRemaining > 0 ? Math.max(Math.round(remaining / dailyPace.daysRemaining), 0) : 0,
          dailyAvgSoFarKrw: dailyPace.dailyAvgKrw,
          projectedTotalKrw: dailyPace.projectedEndOfMonthKrw,
        }
      },
    }),

    getSubscriptions: tool({
      description:
        'Get detected recurring subscriptions with amount, billing frequency, last payment, estimated yearly cost, and confidence. Use for "which subscriptions should I review".',
      inputSchema: z.object({}),
      execute: async () => {
        const dataset = await getDataset()
        const candidates = detectSubscriptionCandidates(dataset.transactions, dataset.recurringTemplates)
        const totalYearly = candidates.reduce((sum, c) => sum + c.estimatedYearlyCostKrw, 0)

        return {
          subscriptions: candidates.map((c) => ({
            name: c.name,
            latestAmountKrw: c.latestAmountKrw,
            averageAmountKrw: c.averageAmountKrw,
            frequency: c.frequency,
            lastPaymentDate: c.lastPaymentDate,
            estimatedYearlyCostKrw: c.estimatedYearlyCostKrw,
            confidence: c.confidence,
            category: c.categoryName,
          })),
          totalYearlyKrw: totalYearly,
          totalMonthlyKrw: Math.round(totalYearly / 12),
          note: 'These are candidates for the user to review. Never state that a subscription was or should be cancelled automatically.',
        }
      },
    }),

    getSavingsGoalPlan: tool({
      description:
        'Get each savings goal with remaining amount, months left, planned vs required monthly contribution, projected completion date, and whether it is on track. Use for "can I reach my $5,000 goal by March".',
      inputSchema: z.object({
        goalName: z.string().max(120).optional().describe('Optional filter to one goal by name (case-insensitive).'),
      }),
      execute: async ({ goalName }) => {
        const dataset = await getDataset()
        let goals = dataset.savingsGoals
        if (goalName) {
          const needle = goalName.toLowerCase()
          goals = goals.filter((g) => g.name.toLowerCase().includes(needle))
        }

        return {
          goals: goals.map((goal) => {
            const plan = computeGoalPlan(goal, dataset.savingsContributions, referenceDate)
            return {
              name: plan.name,
              targetUsd: plan.targetUsd,
              currentUsd: plan.currentUsd,
              remainingUsd: plan.remainingUsd,
              deadline: plan.deadline,
              monthsRemaining: plan.monthsRemaining,
              plannedMonthlyUsd: plan.currentPlannedMonthlyUsd,
              requiredMonthlyUsd: plan.requiredMonthlyUsd,
              projectedCompletionDate: plan.projectedCompletionDate,
              status: plan.status,
            }
          }),
        }
      },
    }),

    simulateBudget: tool({
      description:
        'Simulate setting a category budget to a specific amount and report the monthly/yearly impact and whether it is realistic. Use for "what happens if I reduce food to 350,000". This only simulates — it never saves anything.',
      inputSchema: z.object({
        categoryName: z.string().min(1).max(100).describe('Category name, e.g. "Food"'),
        proposedBudgetKrw: z.number().min(0).max(1_000_000_000),
      }),
      execute: async ({ categoryName, proposedBudgetKrw }) => {
        const dataset = await getDataset()
        const months = getLastCompleteMonths(referenceDate, 3)
        const spends = computeCategoryMonthlySpend(dataset.transactions, months)

        const needle = categoryName.toLowerCase()
        const spend = spends.find((s) => s.categoryName.toLowerCase().includes(needle))
        if (!spend) {
          return { error: `No spending history found for a category matching "${categoryName}".`, availableCategories: spends.map((s) => s.categoryName) }
        }

        const currentBudget = dataset.budgets.find((b) => b.category_id === spend.categoryId)?.amount_krw ?? 0
        return { ...simulateBudgetChange(spend, currentBudget, proposedBudgetKrw), monthsAnalyzed: months }
      },
    }),

    suggestBudgetPlan: tool({
      description:
        'Get adaptive budget recommendations per category based on the last three complete months, with a rationale for each. Recommendations are gradual by design. Always present these and ask the user to confirm before applying anything.',
      inputSchema: z.object({}),
      execute: async () => {
        const [dataset, preferences, snapshot] = await Promise.all([getDataset(), loadFinancialPreferences(supabase, userId), getSnapshot()])

        const plan = buildBudgetPlan({
          transactions: dataset.transactions,
          budgets: dataset.budgets,
          classifications: dataset.classifications,
          incomeBaselineKrw: snapshot.incomeBaseline.conservativeBaselineKrw,
          targetSavingsRatePct: preferences.target_savings_rate,
          referenceDate,
        })

        return {
          monthsAnalyzed: plan.monthsAnalyzed,
          recommendations: plan.recommendations.map((r) => ({
            categoryId: r.categoryId,
            category: r.categoryName,
            currentBudgetKrw: r.currentBudgetKrw,
            recommendedBudgetKrw: r.recommendedBudgetKrw,
            averageMonthlyKrw: r.averageKrw,
            medianMonthlyKrw: r.medianKrw,
            rationale: r.rationale,
          })),
          totalRecommendedKrw: plan.totalRecommendedKrw,
          projectedSavingsRatePct: plan.projectedSavingsRatePct,
          targetSavingsRatePct: plan.targetSavingsRatePct,
          meetsTarget: plan.meetsTarget,
        }
      },
    }),

    getRecentInsights: tool({
      description:
        'Get the AI Money Coach insights already generated for this user, including their status. Use when the user asks about their recommendations or what the coach suggested.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .from('ai_financial_insights')
          .select('title, summary, insight_type, severity, confidence, status, estimated_monthly_savings_krw, period_start, period_end')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)

        return {
          insights: ((data ?? []) as Partial<AIFinancialInsight>[]).map((i) => ({
            title: i.title,
            summary: i.summary,
            type: i.insight_type,
            severity: i.severity,
            confidence: i.confidence,
            status: i.status,
            estimatedMonthlySavingsKrw: i.estimated_monthly_savings_krw,
            period: `${i.period_start} to ${i.period_end}`,
          })),
        }
      },
    }),
  }
}
