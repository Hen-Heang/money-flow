// Ties the deterministic rules to the AI phrasing pass and persistence.
//
// Flow: transactions/budgets -> engine snapshot -> deterministic candidates
//    -> privacy-safe payload -> AI phrasing (validated) -> stored insight.

import { generateObject } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildFinancialSnapshot, buildBudgetPlan } from '@/lib/finance/analysis'
import type { FinancialSnapshot } from '@/lib/finance/analysis'
import { loadFinanceDataset, loadFinancialPreferences } from '@/lib/finance/server/data'
import { getAIProviderOptions, getFastModel, resolveProvider, type AIProvider } from '@/lib/ai-provider'
import { generateInsightCandidates, selectTopInsights, type InsightCandidate } from './rules'
import { AI_PHRASING_SCHEMA, applyAIPhrasing, buildPhrasingPrompt, PHRASING_SYSTEM_PROMPT } from './ai'
import type { AIFinancialInsight, FinancialPreferences } from '@/lib/types'

export interface GeneratedInsights {
  insights: InsightCandidate[]
  snapshot: FinancialSnapshot
  preferences: FinancialPreferences
  aiRewritten: boolean
}

export interface BuildInsightsOptions {
  referenceDate?: Date
  useAI?: boolean
  provider?: AIProvider
}

export async function buildInsightsForUser(
  supabase: SupabaseClient,
  userId: string,
  options: BuildInsightsOptions = {}
): Promise<GeneratedInsights> {
  const referenceDate = options.referenceDate ?? new Date()

  const [dataset, preferences] = await Promise.all([
    loadFinanceDataset(supabase, userId, referenceDate),
    loadFinancialPreferences(supabase, userId),
  ])

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

  const candidates = generateInsightCandidates({ snapshot, budgetPlan, preferences, referenceDate })
  const selected = selectTopInsights(candidates)

  const shouldUseAI = (options.useAI ?? true) && preferences.ai_coach_enabled && selected.length > 0
  if (!shouldUseAI) {
    return { insights: selected, snapshot, preferences, aiRewritten: false }
  }

  try {
    const provider = resolveProvider(options.provider ?? 'gemini')
    const { object } = await generateObject({
      model: getFastModel(provider),
      providerOptions: getAIProviderOptions(provider, userId),
      schema: AI_PHRASING_SCHEMA,
      system: PHRASING_SYSTEM_PROMPT,
      prompt: buildPhrasingPrompt(selected, preferences.share_descriptions_with_ai),
    })

    const { insights, rewrittenCount } = applyAIPhrasing(selected, object)
    return { insights, snapshot, preferences, aiRewritten: rewrittenCount > 0 }
  } catch (error) {
    // AI is a presentation nicety here — the deterministic copy is always
    // correct on its own, so a provider outage must never break the coach.
    console.warn('[insights/generate] AI phrasing unavailable, using deterministic copy:', error)
    return { insights: selected, snapshot, preferences, aiRewritten: false }
  }
}

// Persists freshly-generated insights while preserving the user's decisions:
// an insight the user dismissed or snoozed is not resurrected within its
// active window.
export async function persistInsights(
  supabase: SupabaseClient,
  userId: string,
  insights: InsightCandidate[]
): Promise<AIFinancialInsight[]> {
  if (insights.length === 0) return []

  const now = new Date()
  const periodStart = insights[0].period_start

  const { data: existing } = await supabase
    .from('ai_financial_insights')
    .select('id, evidence, status, snoozed_until')
    .eq('user_id', userId)
    .eq('period_start', periodStart)

  const suppressed = new Set<string>()
  for (const row of existing ?? []) {
    const key = (row.evidence as { insightKey?: string } | null)?.insightKey
    if (!key) continue
    if (row.status === 'dismissed') suppressed.add(key)
    if (row.status === 'snoozed' && row.snoozed_until && new Date(row.snoozed_until) > now) suppressed.add(key)
  }

  const rows = insights
    .filter((insight) => !suppressed.has(insight.key))
    .map((insight) => ({
      user_id: userId,
      period_start: insight.period_start,
      period_end: insight.period_end,
      insight_type: insight.insight_type,
      severity: insight.severity,
      title: insight.title,
      summary: insight.summary,
      // insightKey lets a regenerated insight be matched to the same card
      // the user already acted on.
      evidence: { ...insight.evidence, insightKey: insight.key, role: insight.role, action: insight.action },
      estimated_monthly_savings_krw: insight.estimated_monthly_savings_krw,
      confidence: insight.confidence,
      status: 'new' as const,
      expires_at: new Date(`${insight.period_end}T23:59:59`).toISOString(),
    }))

  if (rows.length === 0) return []

  // Replace only the un-acted-on cards for this period so the list stays at
  // most three and never accumulates stale duplicates.
  await supabase
    .from('ai_financial_insights')
    .delete()
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .in('status', ['new', 'reviewed'])

  const { data, error } = await supabase.from('ai_financial_insights').insert(rows).select('*')
  if (error) {
    console.error('[insights/generate] Failed to persist insights:', error)
    return []
  }

  return (data ?? []) as AIFinancialInsight[]
}
