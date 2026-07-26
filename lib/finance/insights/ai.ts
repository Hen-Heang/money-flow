// AI phrasing layer. The model NEVER produces financial values — it only
// rewrites the deterministic title/summary into warmer prose. Every rewrite
// is validated against the numbers the engine produced; anything that
// introduces an unrecognised figure is discarded and the deterministic copy
// is kept.

import { z } from 'zod'
import type { InsightCandidate } from './rules'

export const AI_PHRASING_SCHEMA = z.object({
  insights: z
    .array(
      z.object({
        index: z.number().int().min(0).max(9),
        title: z.string().trim().min(3).max(90),
        summary: z.string().trim().min(10).max(320),
      })
    )
    .max(3),
})

export type AIPhrasingResult = z.infer<typeof AI_PHRASING_SCHEMA>

// Calendar-ish small integers ("3 months", "12 days") are allowed through so
// natural phrasing isn't rejected. Real financial figures are far larger and
// must be traceable to the engine.
const ALLOWED_SMALL_INTEGER_MAX = 12
const RELATIVE_TOLERANCE = 0.02

function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.add(value)
    into.add(Math.round(value))
    return
  }
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
      const parsed = Number(match[0].replace(/,/g, ''))
      if (Number.isFinite(parsed)) into.add(parsed)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, into)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectNumbers(item, into)
  }
}

// Every figure the model is permitted to mention: whatever the engine put in
// the evidence, plus whatever already appears in the deterministic copy.
export function approvedNumbersFor(candidate: InsightCandidate): Set<number> {
  const approved = new Set<number>()
  collectNumbers(candidate.evidence, approved)
  collectNumbers(candidate.title, approved)
  collectNumbers(candidate.summary, approved)
  if (candidate.estimated_monthly_savings_krw !== null) {
    collectNumbers(candidate.estimated_monthly_savings_krw, approved)
  }
  return approved
}

function isApproved(value: number, approved: Set<number>): boolean {
  if (Number.isInteger(value) && value >= 0 && value <= ALLOWED_SMALL_INTEGER_MAX) return true
  if (approved.has(value)) return true

  for (const candidate of approved) {
    if (candidate === value) return true
    const scale = Math.max(Math.abs(candidate), Math.abs(value))
    if (scale === 0) continue
    if (Math.abs(candidate - value) / scale <= RELATIVE_TOLERANCE) return true
  }
  return false
}

// Returns the figures in `text` that the engine never produced.
export function findUnapprovedNumbers(text: string, approved: Set<number>): number[] {
  const found: number[] = []
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const parsed = Number(match[0].replace(/,/g, ''))
    if (!Number.isFinite(parsed)) continue
    if (!isApproved(parsed, approved)) found.push(parsed)
  }
  return found
}

export interface ApplyPhrasingResult {
  insights: InsightCandidate[]
  rewrittenCount: number
  rejectedCount: number
}

// Merges validated AI phrasing into the candidates. Any failure — malformed
// output, out-of-range index, or an invented number — silently falls back to
// the deterministic copy for that insight.
export function applyAIPhrasing(candidates: InsightCandidate[], raw: unknown): ApplyPhrasingResult {
  const parsed = AI_PHRASING_SCHEMA.safeParse(raw)
  if (!parsed.success) {
    return { insights: candidates, rewrittenCount: 0, rejectedCount: 0 }
  }

  const result = [...candidates]
  let rewrittenCount = 0
  let rejectedCount = 0

  for (const item of parsed.data.insights) {
    const target = result[item.index]
    if (!target) {
      rejectedCount++
      continue
    }

    const approved = approvedNumbersFor(target)
    const invented = [
      ...findUnapprovedNumbers(item.title, approved),
      ...findUnapprovedNumbers(item.summary, approved),
    ]

    if (invented.length > 0) {
      console.warn(
        `[insights/ai] Rejected AI phrasing for "${target.key}" — unverified numbers: ${invented.join(', ')}`
      )
      rejectedCount++
      continue
    }

    result[item.index] = { ...target, title: item.title, summary: item.summary }
    rewrittenCount++
  }

  return { insights: result, rewrittenCount, rejectedCount }
}

// The only thing sent to the model: no ids, no amounts the engine didn't
// compute, no raw transaction rows. Descriptions are stripped when the user
// has turned off description sharing.
export function buildPhrasingPrompt(candidates: InsightCandidate[], shareDescriptions: boolean): string {
  const payload = candidates.map((c, index) => ({
    index,
    role: c.role,
    type: c.insight_type,
    severity: c.severity,
    currentTitle: c.title,
    currentSummary: c.summary,
    facts: shareDescriptions ? c.evidence : stripDescriptions(c.evidence),
  }))

  return JSON.stringify(payload, null, 2)
}

const DESCRIPTION_KEYS = new Set(['description', 'sampleDescription', 'name', 'topSubscriptions', 'goalName', 'goalNames'])

function stripDescriptions(evidence: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(evidence)) {
    if (DESCRIPTION_KEYS.has(key)) continue
    result[key] = value
  }
  return result
}

export const PHRASING_SYSTEM_PROMPT = `You rewrite personal-finance insight cards so they read calmly and clearly.

Rules you must follow exactly:
- Use ONLY the numbers present in the provided facts. Never calculate, estimate, round differently, or introduce any new figure.
- Keep the same meaning as the current title and summary. Do not add advice that isn't supported by the facts.
- Titles: at most 90 characters, no trailing period.
- Summaries: one or two short sentences, at most 320 characters.
- Tone: calm, supportive, non-judgemental, practical. Never say the user was bad, failed, or wasted money.
- Prefer phrasing like "this category exceeded its plan", "here is one adjustment you could try", "this expense may be worth reviewing".
- Use ₩ for Korean won and $ for US dollars, exactly as they appear in the facts.
- Return one entry per insight, preserving its index.`
