// Groups detected subscriptions into rough service families so the review
// page can point out likely overlap ("you have three AI assistants").
//
// This is a labelling hint for the user's own judgement — it never decides
// that a subscription is redundant, and it never changes anything.

import { normalizeDescription } from './normalize'

export type SubscriptionGroup = 'ai' | 'cloud' | 'streaming' | 'storage' | 'delivery' | 'other'

const GROUP_KEYWORDS: Array<{ group: Exclude<SubscriptionGroup, 'other'>; keywords: string[] }> = [
  { group: 'ai', keywords: ['claude', 'chatgpt', 'openai', 'anthropic', 'gemini', 'copilot', 'perplexity', 'midjourney', 'cursor'] },
  { group: 'cloud', keywords: ['aws', 'gcp', 'azure', 'vercel', 'netlify', 'digitalocean', 'linode', 'server', 'hosting', 'supabase', 'render'] },
  { group: 'streaming', keywords: ['netflix', 'youtube', 'spotify', 'disney', 'wavve', 'tving', 'watcha', 'apple music', 'apple tv', 'prime video'] },
  { group: 'storage', keywords: ['icloud', 'dropbox', 'google one', 'onedrive', 'mega', 'storage', 'backup'] },
  { group: 'delivery', keywords: ['coupang', 'baemin', 'kurly', 'yogiyo', 'rocket', 'delivery'] },
]

export const GROUP_LABEL: Record<SubscriptionGroup, string> = {
  ai: 'AI assistants',
  cloud: 'Cloud & hosting',
  streaming: 'Streaming',
  storage: 'Storage & backup',
  delivery: 'Delivery memberships',
  other: 'Other',
}

export function classifySubscriptionGroup(name: string, categoryName?: string | null): SubscriptionGroup {
  const haystack = `${normalizeDescription(name)} ${normalizeDescription(categoryName ?? '')}`

  for (const { group, keywords } of GROUP_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return group
  }
  return 'other'
}

export interface SubscriptionOverlap {
  group: SubscriptionGroup
  label: string
  names: string[]
  combinedYearlyCostKrw: number
}

// Reports families with more than one active subscription. Purely
// informational — the user decides whether the overlap is worth keeping.
export function findSubscriptionOverlaps(
  subscriptions: Array<{ name: string; categoryName: string | null; estimatedYearlyCostKrw: number; status?: string }>
): SubscriptionOverlap[] {
  const byGroup = new Map<SubscriptionGroup, { names: string[]; total: number }>()

  for (const sub of subscriptions) {
    if (sub.status === 'cancelled') continue
    const group = classifySubscriptionGroup(sub.name, sub.categoryName)
    if (group === 'other') continue

    const entry = byGroup.get(group) ?? { names: [], total: 0 }
    entry.names.push(sub.name)
    entry.total += sub.estimatedYearlyCostKrw
    byGroup.set(group, entry)
  }

  return Array.from(byGroup.entries())
    .filter(([, entry]) => entry.names.length > 1)
    .map(([group, entry]) => ({
      group,
      label: GROUP_LABEL[group],
      names: entry.names,
      combinedYearlyCostKrw: entry.total,
    }))
    .sort((a, b) => b.combinedYearlyCostKrw - a.combinedYearlyCostKrw)
}
