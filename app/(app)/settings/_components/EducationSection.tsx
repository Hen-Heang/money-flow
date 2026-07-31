'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { MONEY_TIPS } from '@/shared/data'
import { Group, Row } from './Primitives'
import type { SettingsSection } from '../_types'

export function EducationSection({
  activeSection,
  onToggle,
}: {
  activeSection: SettingsSection | null
  onToggle: (section: SettingsSection) => void
}) {
  return (
    <Group title="Education">
      <Row
        icon={BookOpen}
        color="#a855f7"
        title="Money Tips"
        subtitle="Seoul developer finance guide"
        onClick={() => { haptic('light'); onToggle('tips') }}
        active={activeSection === 'tips'}
      />
      <AnimatePresence>
        {activeSection === 'tips' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[var(--color-card-elevated-base)]/30 px-4 py-5 grid grid-cols-1 gap-3">
              {MONEY_TIPS.map((tip, i) => (
                <div key={i} className="bg-[var(--color-card-base)] p-4 rounded-2xl border border-[var(--color-border-base)] shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{tip.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black tracking-tight">{tip.title}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md" style={{ backgroundColor: tip.tagColor + '15', color: tip.tagColor }}>{tip.tag}</span>
                      </div>
                      <p className="text-[12px] font-medium opacity-60 leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Group>
  )
}
