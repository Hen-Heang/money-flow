import { useState, useEffect } from 'react'
import { FALLBACK_EXCHANGE_RATE } from '@/shared/presets'

// Module-level cache — shared across all hook instances in the same session.
// Prevents duplicate /api/exchange-rate fetches when multiple components mount.
let cachedRate: number | null = null
let pendingFetch: Promise<number> | null = null

async function fetchRate(): Promise<number> {
  if (cachedRate !== null) return cachedRate
  if (!pendingFetch) {
    pendingFetch = fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => {
        const rate = d?.rate ?? FALLBACK_EXCHANGE_RATE
        cachedRate = rate
        pendingFetch = null
        return rate
      })
      .catch(() => {
        pendingFetch = null
        return FALLBACK_EXCHANGE_RATE
      })
  }
  return pendingFetch
}

export function useExchangeRate(): number {
  const [rate, setRate] = useState(cachedRate ?? FALLBACK_EXCHANGE_RATE)

  useEffect(() => {
    if (cachedRate !== null) return
    fetchRate().then(r => setRate(r))
  }, [])

  return rate
}
