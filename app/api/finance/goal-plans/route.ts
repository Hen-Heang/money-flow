import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { computeGoalPlan, detectDoubleCountingWarnings } from '@/lib/finance/analysis'
import { loadSavingsGoals, loadSavingsContributions } from '@/lib/finance/server/data'

// Read-only coaching view over savings goals. Contributions are only ever
// recorded through the confirmed record_savings_contribution RPC — nothing
// here changes a balance.
export async function GET() {
  const { user, supabase } = await requireUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const referenceDate = new Date()
    const [goals, contributions] = await Promise.all([
      loadSavingsGoals(supabase, user.id),
      loadSavingsContributions(supabase, user.id),
    ])

    const plans = goals.map((goal) => {
      const plan = computeGoalPlan(goal, contributions, referenceDate)
      const history = contributions
        .filter((c) => c.goal_id === goal.id)
        .slice(0, 12)
        .map((c) => ({
          amountUsd: c.amount_usd,
          month: c.contribution_month,
          source: c.source,
          createdAt: c.created_at,
        }))

      return { ...plan, contributionHistory: history, contributionCount: contributions.filter((c) => c.goal_id === goal.id).length }
    })

    return NextResponse.json({
      plans,
      doubleCountingWarnings: detectDoubleCountingWarnings(goals, contributions),
    })
  } catch (error) {
    console.error('[api/finance/goal-plans] Load failed:', error)
    return NextResponse.json({ error: 'Could not load goal plans' }, { status: 500 })
  }
}
