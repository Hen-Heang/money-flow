import { useEffect, useRef, useState } from 'react'

export function usePullToRefresh(onRefresh: () => void, threshold = 72) {
  const startY = useRef(0)
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) startY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!startY.current) return
      const dist = e.touches[0].clientY - startY.current
      if (dist > 0 && window.scrollY === 0) {
        setPulling(true)
        setPullDistance(Math.min(dist, threshold * 1.5))
      }
    }

    const onTouchEnd = () => {
      if (pulling && pullDistance >= threshold) {
        onRefresh()
      }
      startY.current = 0
      setPulling(false)
      setPullDistance(0)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [pulling, pullDistance, onRefresh, threshold])

  return { pulling, pullDistance, ready: pullDistance >= threshold }
}
