'use client'

import { useEffect, useRef, useState } from 'react'
import { useMotionValue, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

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
  useEffect(() => {
    formatRef.current = format
  }, [format])

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

  // Inherit the parent's font-size/letter-spacing so wrapper classes like
  // text-7xl / text-9xl take effect (the global `span { font-size: 14px }`
  // base rule would otherwise pin this to 14px).
  return <span className={cn('text-[length:inherit] tracking-[inherit]', className)}>{display}</span>
}
