// UI-facing metadata for category spending classes.
//
// The reduction percentages here mirror REDUCTION_BY_CLASS in
// lib/finance/analysis/budget.ts — they are shown to the user so the effect
// of a classification is never a surprise.

import type { SpendingClass } from '@/lib/finance/analysis'

export interface SpendingClassMeta {
  value: SpendingClass
  label: string
  color: string
  description: string
  /** What budget recommendations will do with this class. */
  effect: string
}

export const SPENDING_CLASSES: SpendingClassMeta[] = [
  {
    value: 'essential',
    label: 'Essential',
    color: '#3b82f6',
    description: 'Costs you cannot go without — rent, utilities, groceries, transport to work.',
    effect: 'Never reduced automatically',
  },
  {
    value: 'commitment',
    label: 'Commitment',
    color: '#8b5cf6',
    description: 'Obligations you have chosen — family support, education, loan repayments.',
    effect: 'Never reduced automatically',
  },
  {
    value: 'growth',
    label: 'Growth',
    color: '#10b981',
    description: 'Spending that builds something — courses, books, health, tools for work.',
    effect: 'Never reduced automatically',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    color: '#f59e0b',
    description: 'Things you enjoy but could adjust — dining out, entertainment, hobbies.',
    effect: 'Suggested budgets trim about 10%',
  },
  {
    value: 'avoidable',
    label: 'Avoidable',
    color: '#f97316',
    description: 'The first place you would cut if you wanted to free up money.',
    effect: 'Suggested budgets trim about 20%',
  },
]

export const SPENDING_CLASS_BY_VALUE: Record<SpendingClass, SpendingClassMeta> = Object.fromEntries(
  SPENDING_CLASSES.map((meta) => [meta.value, meta])
) as Record<SpendingClass, SpendingClassMeta>

export const UNCLASSIFIED_META = {
  label: 'Not set',
  color: '#94a3b8',
  description: 'Unclassified categories are never reduced automatically.',
  effect: 'Never reduced automatically',
}

export function spendingClassLabel(value: SpendingClass | null | undefined): string {
  return value ? SPENDING_CLASS_BY_VALUE[value].label : UNCLASSIFIED_META.label
}

export function spendingClassColor(value: SpendingClass | null | undefined): string {
  return value ? SPENDING_CLASS_BY_VALUE[value].color : UNCLASSIFIED_META.color
}
