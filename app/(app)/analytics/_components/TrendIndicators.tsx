'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export function TrendBadge({ current, previous, invertColor = false }: { current: number; previous: number; invertColor?: boolean }) {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const isUp = pct > 0
  const isFlat = Math.abs(pct) < 0.5

  if (isFlat) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>
      <Minus className="h-3 w-3" /> —
    </span>
  )

  // invertColor: for expenses, going UP is bad (red), going DOWN is good (green)
  const isGood = invertColor ? !isUp : isUp
  const color = isGood ? 'var(--color-income-base)' : 'var(--color-expense-base)'

  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color }}>
      {isUp
        ? <TrendingUp className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />
      }
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export function TrendPill({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null
  const isUp = pct > 0
  const isFlat = Math.abs(pct) < 0.5
  if (isFlat) return (
    <span className="flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
      <Minus size={9} /> Flat
    </span>
  )
  const isGood = invert ? !isUp : isUp
  const color = isGood ? '#22c55e' : '#ef4444'
  const bg = isGood ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>
      {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}
