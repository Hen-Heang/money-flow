// Server-side loaders that turn Supabase rows into the plain objects the
// analysis engine expects. Every query is user-scoped; RLS is the backstop
// but we filter explicitly too so a mistake can't widen the result set.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EngineTransaction,
  EngineBudget,
  EngineSavingsGoal,
  EngineSavingsContribution,
  SpendingClass,
  StoredAlias,
} from '@/lib/finance/analysis'
import type { RecurringTemplateHint } from '@/lib/finance/analysis'
import { applyAliasesToTransactions } from '@/lib/finance/analysis'
import type { FinancialPreferences } from '@/lib/types'

// Supabase returns embedded relations as an object or a single-element array
// depending on the query shape — normalize both.
function rel<T>(value: unknown): T | null {
  if (!value) return null
  return (Array.isArray(value) ? value[0] : value) as T
}

// 13 months so a yearly subscription can be seen paying twice.
const DEFAULT_LOOKBACK_MONTHS = 13

export function lookbackStartDate(referenceDate: Date, months = DEFAULT_LOOKBACK_MONTHS): string {
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export interface FinanceDataset {
  /** Descriptions already resolved to their user-confirmed canonical form. */
  transactions: EngineTransaction[]
  budgets: EngineBudget[]
  savingsGoals: EngineSavingsGoal[]
  savingsContributions: EngineSavingsContribution[]
  recurringTemplates: RecurringTemplateHint[]
  classifications: Record<string, SpendingClass>
  aliases: StoredAlias[]
}

export async function loadTransactions(
  supabase: SupabaseClient,
  userId: string,
  fromDate: string
): Promise<EngineTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, date, type, amount_krw, amount_usd, currency, description, category_id, payment_method_id, categories(name), payment_methods(name)'
    )
    .eq('user_id', userId)
    .gte('date', fromDate)
    .order('date', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row): EngineTransaction => {
    const category = rel<{ name: string }>(row.categories)
    const paymentMethod = rel<{ name: string }>(row.payment_methods)
    return {
      id: row.id,
      date: row.date,
      type: row.type,
      amount_krw: Number(row.amount_krw) || 0,
      amount_usd: Number(row.amount_usd) || 0,
      currency: row.currency ?? 'KRW',
      category_id: row.category_id,
      category_name: category?.name ?? null,
      payment_method_id: row.payment_method_id,
      payment_method_name: paymentMethod?.name ?? null,
      description: row.description ?? '',
    }
  })
}

export async function loadBudgets(supabase: SupabaseClient, userId: string): Promise<EngineBudget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('category_id, amount_krw, categories(name)')
    .eq('user_id', userId)
    .gt('amount_krw', 0)

  if (error) throw error

  return (data ?? []).map((row): EngineBudget => ({
    category_id: row.category_id,
    category_name: rel<{ name: string }>(row.categories)?.name ?? 'Uncategorized',
    amount_krw: Number(row.amount_krw) || 0,
  }))
}

export async function loadSavingsGoals(supabase: SupabaseClient, userId: string): Promise<EngineSavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id, name, target_usd, current_usd, deadline, auto_monthly_usd, purpose')
    .eq('user_id', userId)

  if (error) throw error

  return (data ?? []).map((row): EngineSavingsGoal => ({
    id: row.id,
    name: row.name,
    target_usd: Number(row.target_usd) || 0,
    current_usd: Number(row.current_usd) || 0,
    deadline: row.deadline,
    auto_monthly_usd: Number(row.auto_monthly_usd) || 0,
    purpose: row.purpose,
  }))
}

export async function loadSavingsContributions(
  supabase: SupabaseClient,
  userId: string
): Promise<EngineSavingsContribution[]> {
  const { data, error } = await supabase
    .from('savings_contributions')
    .select('goal_id, amount_usd, contribution_month, source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  return (data ?? []).map((row): EngineSavingsContribution => ({
    goal_id: row.goal_id,
    amount_usd: Number(row.amount_usd) || 0,
    contribution_month: row.contribution_month,
    source: row.source,
    created_at: row.created_at,
  }))
}

export async function loadRecurringTemplates(
  supabase: SupabaseClient,
  userId: string
): Promise<RecurringTemplateHint[]> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('description, amount_krw, categories(name)')
    .eq('user_id', userId)
    .eq('type', 'expense')

  if (error) throw error

  return (data ?? []).map((row): RecurringTemplateHint => ({
    description: row.description ?? '',
    amount_krw: Number(row.amount_krw) || 0,
    category_name: rel<{ name: string }>(row.categories)?.name ?? null,
  }))
}

export async function loadAliases(supabase: SupabaseClient, userId: string): Promise<StoredAlias[]> {
  const { data, error } = await supabase
    .from('transaction_description_aliases')
    .select('normalized_key, canonical_description')
    .eq('user_id', userId)

  if (error) throw error

  return (data ?? []).map((row): StoredAlias => ({
    normalizedKey: row.normalized_key,
    canonicalDescription: row.canonical_description,
  }))
}

export async function loadCategoryClassifications(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, SpendingClass>> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, spending_class')
    .eq('user_id', userId)
    .not('spending_class', 'is', null)

  if (error) throw error

  const result: Record<string, SpendingClass> = {}
  for (const row of data ?? []) {
    if (row.spending_class) result[row.id] = row.spending_class as SpendingClass
  }
  return result
}

const DEFAULT_PREFERENCES: FinancialPreferences = {
  target_savings_rate: 20,
  monthly_spending_limit_krw: null,
  ai_coach_enabled: true,
  weekly_review_enabled: true,
  monthly_review_enabled: true,
  share_descriptions_with_ai: true,
  budget_warning_thresholds: { first: 70, strong: 90, over: 100 },
  quiet_hours: { enabled: false, start: '22:00', end: '08:00', timezone: 'Asia/Seoul' },
  monthly_report_channel_telegram: true,
  monthly_report_channel_email: false,
  monthly_report_email: null,
}

// Returns saved preferences merged over defaults. A user who has never
// opened the AI settings page simply has no row yet.
export async function loadFinancialPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<FinancialPreferences> {
  const { data, error } = await supabase
    .from('financial_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return { ...DEFAULT_PREFERENCES }

  return {
    target_savings_rate: Number(data.target_savings_rate ?? DEFAULT_PREFERENCES.target_savings_rate),
    monthly_spending_limit_krw:
      data.monthly_spending_limit_krw === null || data.monthly_spending_limit_krw === undefined
        ? null
        : Number(data.monthly_spending_limit_krw),
    ai_coach_enabled: data.ai_coach_enabled ?? true,
    weekly_review_enabled: data.weekly_review_enabled ?? true,
    monthly_review_enabled: data.monthly_review_enabled ?? true,
    share_descriptions_with_ai: data.share_descriptions_with_ai ?? true,
    budget_warning_thresholds: data.budget_warning_thresholds ?? DEFAULT_PREFERENCES.budget_warning_thresholds,
    quiet_hours: data.quiet_hours ?? DEFAULT_PREFERENCES.quiet_hours,
    monthly_report_channel_telegram: data.monthly_report_channel_telegram ?? true,
    monthly_report_channel_email: data.monthly_report_channel_email ?? false,
    monthly_report_email: data.monthly_report_email ?? null,
  }
}

export { DEFAULT_PREFERENCES }

// One round-trip per table, run in parallel — this is the entry point every
// AI/coach route uses.
export async function loadFinanceDataset(
  supabase: SupabaseClient,
  userId: string,
  referenceDate: Date = new Date(),
  lookbackMonths = DEFAULT_LOOKBACK_MONTHS
): Promise<FinanceDataset> {
  const fromDate = lookbackStartDate(referenceDate, lookbackMonths)

  const [transactions, budgets, savingsGoals, savingsContributions, recurringTemplates, classifications, aliases] =
    await Promise.all([
      loadTransactions(supabase, userId, fromDate),
      loadBudgets(supabase, userId),
      loadSavingsGoals(supabase, userId),
      loadSavingsContributions(supabase, userId),
      loadRecurringTemplates(supabase, userId),
      loadCategoryClassifications(supabase, userId),
      loadAliases(supabase, userId),
    ])

  return {
    // Resolved once here so every downstream calculation — totals, top
    // descriptions, subscription grouping — respects confirmed merges.
    transactions: applyAliasesToTransactions(transactions, aliases),
    budgets,
    savingsGoals,
    savingsContributions,
    recurringTemplates,
    classifications,
    aliases,
  }
}
