// Small shared statistics helpers. Kept separate from money.ts because these
// operate on plain numbers (already rounded KRW) rather than Decimal values.

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Median Absolute Deviation — robust to outliers, which matters when the
// thing we're looking for IS the outlier.
export function medianAbsoluteDeviation(values: number[], med = median(values)): number {
  return median(values.map((v) => Math.abs(v - med)))
}

// Returns the last `count` complete (non-current) months as 'YYYY-MM',
// oldest first.
export function getLastCompleteMonths(referenceDate: Date, count: number): string[] {
  const months: string[] = []
  for (let i = count; i >= 1; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

// Rounds to a human-friendly step so recommended budgets read as round
// numbers (₩380,000) rather than raw averages (₩378,412).
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value)
  return Math.round(value / step) * step
}

export function budgetRoundingStep(value: number): number {
  if (value >= 100_000) return 10_000
  if (value >= 10_000) return 1_000
  return 500
}
