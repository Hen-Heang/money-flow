import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  AI_PHRASING_SCHEMA,
  applyAIPhrasing,
  approvedNumbersFor,
  findUnapprovedNumbers,
  buildPhrasingPrompt,
} from '../ai'
import type { InsightCandidate } from '../rules'

function candidate(overrides: Partial<InsightCandidate> = {}): InsightCandidate {
  return {
    key: 'warning:budget:cat-food',
    role: 'warning',
    insight_type: 'category_overspend',
    severity: 'warning',
    title: 'Food spending may exceed its budget by ₩28,000',
    summary: 'Food is at ₩292,000 of ₩350,000 after 20 days.',
    evidence: { category: 'Food', spentKrw: 292_000, budgetKrw: 350_000, overshootKrw: 28_000, daysPassed: 20 },
    estimated_monthly_savings_krw: 28_000,
    confidence: 'high',
    priority: 100,
    action: { kind: 'view_analytics', label: 'Review category' },
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AI_PHRASING_SCHEMA', () => {
  it('accepts well-formed output', () => {
    const result = AI_PHRASING_SCHEMA.safeParse({
      insights: [{ index: 0, title: 'Food is close to its plan', summary: 'Food is at ₩292,000 of ₩350,000 this month.' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects output missing required fields', () => {
    expect(AI_PHRASING_SCHEMA.safeParse({ insights: [{ index: 0, title: 'Hi' }] }).success).toBe(false)
  })

  it('rejects more than three insights', () => {
    const insights = Array.from({ length: 4 }, (_, i) => ({ index: i, title: 'A valid title', summary: 'A valid summary here.' }))
    expect(AI_PHRASING_SCHEMA.safeParse({ insights }).success).toBe(false)
  })

  it('rejects an over-long title', () => {
    const result = AI_PHRASING_SCHEMA.safeParse({
      insights: [{ index: 0, title: 'x'.repeat(120), summary: 'A valid summary here.' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('approvedNumbersFor / findUnapprovedNumbers', () => {
  it('approves every number the engine produced', () => {
    const approved = approvedNumbersFor(candidate())
    expect(findUnapprovedNumbers('Food is at ₩292,000 of ₩350,000, over by ₩28,000', approved)).toEqual([])
  })

  it('flags a number the engine never produced', () => {
    const approved = approvedNumbersFor(candidate())
    expect(findUnapprovedNumbers('You could save ₩99,999 by cutting back', approved)).toEqual([99_999])
  })

  it('allows small calendar integers so natural phrasing is not rejected', () => {
    const approved = approvedNumbersFor(candidate())
    expect(findUnapprovedNumbers('Over the next 3 months, with 11 days left', approved)).toEqual([])
  })

  it('tolerates minor rounding of an approved figure', () => {
    const approved = approvedNumbersFor(candidate({ evidence: { spentKrw: 291_950 } }))
    expect(findUnapprovedNumbers('about ₩292,000', approved)).toEqual([])
  })
})

describe('applyAIPhrasing', () => {
  it('applies valid phrasing that only uses engine numbers', () => {
    const result = applyAIPhrasing(
      [candidate()],
      { insights: [{ index: 0, title: 'Food is close to its plan', summary: 'Food is at ₩292,000 of its ₩350,000 plan.' }] }
    )
    expect(result.rewrittenCount).toBe(1)
    expect(result.rejectedCount).toBe(0)
    expect(result.insights[0].title).toBe('Food is close to its plan')
  })

  it('rejects phrasing that invents a financial number and keeps the deterministic copy', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const original = candidate()
    const result = applyAIPhrasing(
      [original],
      { insights: [{ index: 0, title: 'You overspent by ₩500,000', summary: 'Cut ₩120,000 from food to recover.' }] }
    )
    expect(result.rewrittenCount).toBe(0)
    expect(result.rejectedCount).toBe(1)
    expect(result.insights[0].title).toBe(original.title)
    expect(result.insights[0].summary).toBe(original.summary)
  })

  it('falls back cleanly when the model returns malformed output', () => {
    const original = candidate()
    const result = applyAIPhrasing([original], { nonsense: true })
    expect(result.rewrittenCount).toBe(0)
    expect(result.insights[0]).toEqual(original)
  })

  it('ignores an out-of-range index instead of throwing', () => {
    const result = applyAIPhrasing(
      [candidate()],
      { insights: [{ index: 5, title: 'A valid title', summary: 'A valid summary here.' }] }
    )
    expect(result.rejectedCount).toBe(1)
    expect(result.insights).toHaveLength(1)
  })

  it('never mutates evidence or the estimated savings figure', () => {
    const original = candidate()
    const result = applyAIPhrasing(
      [original],
      { insights: [{ index: 0, title: 'Food is close to its plan', summary: 'Food is at ₩292,000 of its ₩350,000 plan.' }] }
    )
    expect(result.insights[0].evidence).toEqual(original.evidence)
    expect(result.insights[0].estimated_monthly_savings_krw).toBe(28_000)
  })
})

describe('buildPhrasingPrompt — privacy', () => {
  it('includes only role, type, severity, copy and facts — never ids', () => {
    const prompt = buildPhrasingPrompt([candidate()], true)
    expect(prompt).toContain('category_overspend')
    expect(prompt).not.toContain('cat-food')
    expect(prompt).not.toContain('user_id')
  })

  it('strips descriptions when the user has disabled description sharing', () => {
    const withDescription = candidate({
      evidence: { description: 'Claude AI Pro', amountKrw: 27_000, category: 'Software' },
    })
    const shared = buildPhrasingPrompt([withDescription], true)
    const stripped = buildPhrasingPrompt([withDescription], false)

    expect(shared).toContain('Claude AI Pro')
    expect(stripped).not.toContain('Claude AI Pro')
    expect(stripped).toContain('27000')
  })
})
