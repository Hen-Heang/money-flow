import { useState, useEffect } from 'react'

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
        const rate = d?.rate ?? 1350
        cachedRate = rate
        pendingFetch = null
        return rate
      })
      .catch(() => {
        pendingFetch = null
        return 1350
      })
  }
  return pendingFetch
}

export function useExchangeRate(): number {
  const [rate, setRate] = useState(cachedRate ?? 1350)

  useEffect(() => {
    if (cachedRate !== null) return
    fetchRate().then(r => setRate(r))
  }, [])

  return rate
}
