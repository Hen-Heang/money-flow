import { useState, useEffect } from 'react'

export function useExchangeRate(): number {
  const [rate, setRate] = useState(1350)

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d?.rate) setRate(d.rate) })
      .catch(() => {})
  }, [])

  return rate
}
