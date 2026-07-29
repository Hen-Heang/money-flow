// Shared domain types — import from here instead of redefining per-file

export interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  description: string
  amount_krw: number
  amount_usd: number
  currency?: string
  exchange_rate?: number
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  categories?: { name: string; icon: string; color: string } | null
  payment_methods?: { name: string; icon: string } | null
}

export type SpendingClassValue = 'essential' | 'commitment' | 'growth' | 'flexible' | 'avoidable'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'income' | 'expense' | 'both'
  /** Drives adaptive budget recommendations. NULL means never auto-reduced. */
  spending_class?: SpendingClassValue | null
}

export interface PaymentMethod {
  id: string
  name: string
  icon: string
}

export interface TransactionPreview {
  amount: number
  currency: 'KRW' | 'USD'
  type: 'income' | 'expense'
  date: string
  description: string
  categoryId: string | null
  paymentMethodId: string | null
  note: string | null
  confidence: number
}

export interface Budget {
  category_id: string
  amount_krw: number
  categories?: { name: string; icon: string; color: string } | null
}

export interface ExchangeRateInfo {
  rate: number
  base_currency: string
  target_currency: string
  fetched_at: string
  cached?: boolean
  fallback?: boolean
  error?: boolean
}

// ── AI Money Coach ──────────────────────────────────────────────────────

export type InsightType =
  | 'positive_trend'
  | 'category_overspend'
  | 'budget_recommendation'
  | 'subscription_review'
  | 'savings_goal'
  | 'small_purchases'
  | 'duplicate_transaction'
  | 'income_baseline'
  | 'unusual_transaction'
  | 'double_counting'
  | 'general'

export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical'
export type InsightConfidence = 'low' | 'medium' | 'high'
export type InsightStatus = 'new' | 'reviewed' | 'accepted' | 'dismissed' | 'snoozed'

export interface AIFinancialInsight {
  id: string
  user_id?: string
  period_start: string
  period_end: string
  insight_type: InsightType
  severity: InsightSeverity
  title: string
  summary: string
  evidence: Record<string, unknown>
  estimated_monthly_savings_krw: number | null
  confidence: InsightConfidence
  status: InsightStatus
  snoozed_until: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface FinancialPreferences {
  user_id?: string
  target_savings_rate: number
  monthly_spending_limit_krw: number | null
  ai_coach_enabled: boolean
  weekly_review_enabled: boolean
  monthly_review_enabled: boolean
  share_descriptions_with_ai: boolean
  budget_warning_thresholds: { first: number; strong: number; over: number }
  quiet_hours: { enabled: boolean; start: string; end: string; timezone: string }
  /** Send the monthly report to Telegram (requires a linked chat). */
  monthly_report_channel_telegram: boolean
  /** Send the monthly report by email. */
  monthly_report_channel_email: boolean
  /** Overrides the account email for report delivery. Null = use the account email. */
  monthly_report_email: string | null
}

export type MonthlyReportDeliveryChannel = 'telegram' | 'email'
export type MonthlyReportDeliveryStatus = 'pending' | 'sent' | 'failed'

export interface MonthlyReportDelivery {
  id: string
  user_id: string
  report_month: string
  channel: MonthlyReportDeliveryChannel
  status: MonthlyReportDeliveryStatus
  provider_message_id: string | null
  error_message: string | null
  attempted_at: string
  delivered_at: string | null
}

export type SubscriptionDecisionStatus = 'keep' | 'review' | 'plan_to_cancel' | 'cancelled'

export interface SubscriptionStatusRecord {
  id: string
  subscription_key: string
  display_name: string
  status: SubscriptionDecisionStatus
  note: string | null
}

export interface TransactionDescriptionAlias {
  id: string
  canonical_description: string
  variant_description: string
  normalized_key: string
}
