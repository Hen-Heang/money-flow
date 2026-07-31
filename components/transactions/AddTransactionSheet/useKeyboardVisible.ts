import { useState, useEffect } from 'react'

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setVisible(window.innerHeight - vv.height > 100)
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
  return visible
}
