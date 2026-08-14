'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CreditCard, Sparkles, Check } from 'lucide-react'
import { haptic } from '@/lib/utils'
import type { AIProvider } from '@/lib/ai-provider'
import { Group, Row } from './Primitives'
import type { SettingsSection } from '../_types'

const PROVIDER_META: Record<AIProvider, { label: string; badge: string; badgeClass: string }> = {
  gemini: {
    label: 'Google Gemini',
    badge: 'Gemini',
    badgeClass: 'bg-blue-500/10 text-blue-400',
  },
  openai: {
    label: 'OpenAI GPT-5.6',
    badge: 'GPT-5.6',
    badgeClass: 'bg-emerald-500/10 text-emerald-400',
  },
  ling: {
    label: 'Ling 3.0 Tiny',
    badge: 'Ling Tiny',
    badgeClass: 'bg-violet-500/10 text-violet-400',
  },
}

const PROVIDER_OPTIONS: Array<{
  id: AIProvider
  label: string
  desc: string
  emoji: string
}> = [
  { id: 'ling', label: 'Ling 3.0 Tiny', desc: 'Free listing · Vercel AI Gateway', emoji: '⚡' },
  { id: 'gemini', label: 'Google Gemini', desc: 'gemini-2.5-flash · Default fallback', emoji: '🤖' },
  { id: 'openai', label: 'OpenAI ChatGPT', desc: 'GPT-5.6 · Requires OPENAI_API_KEY', emoji: '✨' },
]

export function AIAssistantSection({
  aiProvider,
  aiSwitching,
  switchAIProvider,
  activeSection,
  onToggle,
}: {
  aiProvider: AIProvider
  aiSwitching: boolean
  switchAIProvider: (provider: AIProvider) => void
  activeSection: SettingsSection | null
  onToggle: (section: SettingsSection) => void
}) {
  const router = useRouter()
  const currentProvider = PROVIDER_META[aiProvider]

  return (
    <Group title="AI Assistant">
      <Row
        icon={Sparkles}
        color="#8b5cf6"
        title={currentProvider.label}
        subtitle="Powers chat, Smart Quick Add & categorization"
        onClick={() => { haptic('light'); onToggle('ai') }}
        active={activeSection === 'ai'}
        right={
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentProvider.badgeClass}`}>
            {currentProvider.badge}
          </span>
        }
      />
      <AnimatePresence>
        {activeSection === 'ai' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[var(--color-card-elevated-base)]/30 px-5 py-5 space-y-3">
              <p className="text-[12px] font-medium opacity-60 leading-relaxed">
                Choose your preferred AI engine. Smart transaction tasks automatically try another configured provider if the first one is unavailable.
              </p>
              {PROVIDER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  disabled={aiSwitching}
                  onClick={() => switchAIProvider(opt.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] disabled:opacity-50 ${aiProvider === opt.id ? 'border-[var(--color-accent-base)] bg-[var(--color-accent-base)]/5' : 'border-[var(--color-border-base)] bg-[var(--color-card-base)]'}`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-black">{opt.label}</p>
                    <p className="text-[11px] font-medium opacity-50">{opt.desc}</p>
                  </div>
                  {aiProvider === opt.id && <Check size={16} className="text-[var(--color-accent-base)] shrink-0" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Row
        icon={Sparkles}
        color="#6366f1"
        title="AI Money Coach"
        subtitle="Coaching, notification thresholds & privacy"
        onClick={() => { haptic('light'); router.push('/settings/ai') }}
      />
      <Row
        icon={CreditCard}
        color="#a855f7"
        title="Subscriptions"
        subtitle="Review detected recurring payments"
        onClick={() => { haptic('light'); router.push('/subscriptions') }}
      />
    </Group>
  )
}
