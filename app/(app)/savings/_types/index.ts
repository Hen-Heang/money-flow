export interface SavingsGoal {
  id: string
  name: string
  icon: string
  color: string
  target_usd: number
  current_usd: number
  deadline: string | null
  note: string | null
  purpose: string | null
  auto_monthly_usd: number
  reminder_day: number
  last_reminder_month: string | null
  last_contribution_month: string | null
  skipped_month: string | null
}

export type SavingsGoalInput = Pick<
  SavingsGoal,
  'name' | 'icon' | 'color' | 'target_usd' | 'current_usd' | 'deadline' | 'note' | 'purpose' | 'auto_monthly_usd' | 'reminder_day'
>

export type ContributionMode = 'manual' | 'planned'

export interface SavingsContributionResult {
  new_total: number
  applied_amount: number
  achieved: boolean
  applied: boolean
}
