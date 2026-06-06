'use client'

import { useEffect, useRef, useState } from 'react'
import { useMotionValue, animate } from 'framer-motion'

interface Props {
  value: number
  format: (n: number) => string
  className?: string
}

export function AnimatedNumber({ value, format, className }: Props) {
  const mv = useMotionValue(0)
  const formatRef = useRef(format)
  const [display, setDisplay] = useState(() => format(0))

  // Always keep formatRef pointing at the latest formatter
  formatRef.current = format

  // Subscribe to motion value updates and push to React state
  useEffect(() => {
    return mv.on('change', (latest) => {
      setDisplay(formatRef.current(Math.round(latest)))
    })
  }, [mv])

  // Animate toward the new value whenever it changes
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    })
    return controls.stop
  }, [value, mv])

  // Re-format immediately when currency/format function changes
  useEffect(() => {
    setDisplay(format(Math.round(mv.get())))
  }, [format, mv])

  return <span className={className}>{display}</span>
}
