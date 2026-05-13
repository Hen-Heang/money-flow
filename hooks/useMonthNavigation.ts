import { useState } from 'react'

export function useMonthNavigation(options?: { disableFuture?: boolean }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  function navigateMonth(dir: -1 | 1) {
    if (dir === 1 && options?.disableFuture && isCurrentMonth) return
    setMonth(prev => {
      const next = prev + dir
      if (next < 1) { setYear(y => y - 1); return 12 }
      if (next > 12) { setYear(y => y + 1); return 1 }
      return next
    })
  }

  return { year, month, isCurrentMonth, navigateMonth }
}
