import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildBudgetPlan, buildFinancialSnapshot, computeCategoryMonthlySpend, simulateBudgetChange, getLastCompleteMonths } from '@/lib/finance/analysis'
import { loadFinanceDataset, loadFinancialPreferences } from '@/lib/finance/server/data'

// Adaptive budget recommendations. Read-only: applying a recommendation is
// always a separate, explicitly-confirmed write from the client.
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const referenceDate = new Date()
    const [dataset, preferences] = await Promise.all([
      loadFinanceDataset(supabase, user.id, referenceDate),
      loadFinancialPreferences(supabase, user.id),
    ])

    const snapshot = buildFinancialSnapshot({
      transactions: dataset.transactions,
      budgets: dataset.budgets,
      savingsGoals: dataset.savingsGoals,
      savingsContributions: dataset.savingsContributions,
      recurringTemplates: dataset.recurringTemplates,
      referenceDate,
    })

    const plan = buildBudgetPlan({
      transactions: dataset.transactions,
      budgets: dataset.budgets,
      classifications: dataset.classifications,
      incomeBaselineKrw: snapshot.incomeBaseline.conservativeBaselineKrw,
      targetSavingsRatePct: preferences.target_savings_rate,
      referenceDate,
    })

    return NextResponse.json({ plan, incomeBaseline: snapshot.incomeBaseline })
  } catch (error) {
    console.error('[api/finance/budget-plan] Load failed:', error)
    return NextResponse.json({ error: 'Could not build budget plan' }, { status: 500 })
  }
}

const simulateSchema = z.object({
  categoryId: z.string().uuid(),
  proposedBudgetKrw: z.number().min(0).max(1_000_000_000),
})

// "What happens if I reduce food to ₩350,000?" — pure simulation.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = simulateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  try {
    const referenceDate = new Date()
    const dataset = await loadFinanceDataset(supabase, user.id, referenceDate)
    const months = getLastCompleteMonths(referenceDate, 3)
    const spends = computeCategoryMonthlySpend(dataset.transactions, months)
    const spend = spends.find((s) => s.categoryId === parsed.data.categoryId)

    if (!spend) {
      return NextResponse.json({ error: 'No spending history for that category' }, { status: 404 })
    }

    const currentBudget = dataset.budgets.find((b) => b.category_id === parsed.data.categoryId)?.amount_krw ?? 0
    const simulation = simulateBudgetChange(spend, currentBudget, parsed.data.proposedBudgetKrw)

    return NextResponse.json({ simulation })
  } catch (error) {
    console.error('[api/finance/budget-plan] Simulation failed:', error)
    return NextResponse.json({ error: 'Could not simulate budget change' }, { status: 500 })
  }
}
