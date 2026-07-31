'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { Group, Row } from './Primitives'

export function AppearanceSection() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true
  )

  const toggleTheme = () => {
    haptic('light')
    const html = document.documentElement
    const goingLight = !html.classList.contains('light')
    html.classList.toggle('light', goingLight)
    setIsDark(!goingLight)
    try { localStorage.setItem('theme', goingLight ? 'light' : 'dark') } catch {}
  }

  return (
    <Group title="Appearance">
      <Row
        icon={isDark ? Moon : Sun}
        color="var(--color-warning-base)"
        title={isDark ? 'Dark Mode' : 'Light Mode'}
        subtitle="Toggle visual theme"
        onClick={toggleTheme}
        right={
          <div
            className="w-11 h-6 rounded-full relative transition-colors shadow-inner"
            style={{ backgroundColor: isDark ? 'var(--color-income-base)' : 'var(--color-border-base)' }}
          >
            <motion.div
              animate={{ x: isDark ? 22 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
            />
          </div>
        }
      />
    </Group>
  )
}
