'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

const CONFETTI_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#fbbf24']

// Generated once at module load — safe from render purity rules
const CONFETTI_PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  x: (Math.random() - 0.5) * 320,
  y: -(Math.random() * 480 + 120),
  rotate: Math.random() * 720 - 360,
  scale: Math.random() * 0.6 + 0.4,
  delay: Math.random() * 0.3,
}))

export function ConfettiCelebration({ goalName, goalColor, onDone }: { goalName: string; goalColor: string; onDone: () => void }) {
  const particles = CONFETTI_PARTICLES

  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
    >
      {/* Burst origin */}
      <div className="relative">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: p.color, top: 0, left: 0 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: p.scale }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: p.scale * 0.5 }}
            transition={{ duration: 1.6, delay: p.delay, ease: [0.2, 0.8, 0.4, 1] }}
          />
        ))}

        {/* Central badge */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-3 px-8 py-6 rounded-3xl shadow-2xl pointer-events-auto"
          style={{ backgroundColor: goalColor, boxShadow: `0 24px 60px ${goalColor}60` }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={onDone}
        >
          <motion.span
            className="text-5xl"
            animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            🎉
          </motion.span>
          <div className="text-center text-white">
            <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Goal Achieved!</p>
            <p className="text-lg font-black leading-tight">{goalName}</p>
          </div>
          <p className="text-[10px] text-white/50 font-bold">Tap to continue</p>
        </motion.div>
      </div>
    </motion.div>
  )
}
