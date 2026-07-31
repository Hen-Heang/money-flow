'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Send, Copy } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { Group, Row } from './Primitives'
import type { SettingsSection } from '../_types'

export function TelegramSection({
  telegramLinked,
  setTelegramLinked,
  activeSection,
  onToggle,
}: {
  telegramLinked: boolean
  setTelegramLinked: (linked: boolean) => void
  activeSection: SettingsSection | null
  onToggle: (section: SettingsSection) => void
}) {
  const [telegramCode, setTelegramCode] = useState<{ code: string; deepLink: string | null } | null>(null)
  const [telegramLoading, setTelegramLoading] = useState(false)

  const connectTelegram = async () => {
    haptic('light')
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json() as { code: string; deepLink: string | null }
      setTelegramCode({ code: data.code, deepLink: data.deepLink })
    } catch {
      toast.error('Could not generate a code')
    } finally {
      setTelegramLoading(false)
    }
  }

  const unlinkTelegram = async () => {
    haptic('medium')
    try {
      const res = await fetch('/api/telegram/link', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setTelegramLinked(false)
      setTelegramCode(null)
      toast.success('Telegram disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const copyTelegramCode = async () => {
    if (!telegramCode) return
    try {
      await navigator.clipboard.writeText(telegramCode.code)
      toast.success('Code copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <Group title="Connections">
      <Row
        icon={Send}
        color="#229ED9"
        title="Telegram Bot"
        subtitle={telegramLinked ? 'Connected — log expenses by chat' : 'Log expenses & get alerts via chat'}
        onClick={() => { haptic('light'); onToggle('telegram') }}
        active={activeSection === 'telegram'}
        right={telegramLinked ? (
          <span className="px-2.5 py-1 rounded-full bg-[var(--color-income-base)]/15 text-[10px] font-black uppercase tracking-widest text-[var(--color-income-base)]">
            Linked
          </span>
        ) : undefined}
      />
      <AnimatePresence>
        {activeSection === 'telegram' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[var(--color-card-elevated-base)]/30 px-5 py-5 space-y-4">
              {telegramLinked ? (
                <>
                  <p className="text-[13px] font-medium opacity-70 leading-relaxed">
                    Your Telegram is connected. Open the bot and type things like <span className="font-bold">&ldquo;coffee 4500&rdquo;</span> to log instantly, or send <span className="font-bold">/balance</span>, <span className="font-bold">/today</span>, <span className="font-bold">/budget</span>.
                  </p>
                  <button
                    onClick={unlinkTelegram}
                    className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-transform"
                  >
                    Disconnect
                  </button>
                </>
              ) : telegramCode ? (
                <>
                  <p className="text-[13px] font-medium opacity-70 leading-relaxed">
                    Open the bot and send <span className="font-bold">/link {telegramCode.code}</span>, or just tap the button below. Code expires in 15 minutes.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl px-4 py-3 text-center text-2xl font-black tracking-[0.3em]">
                      {telegramCode.code}
                    </div>
                    <button onClick={copyTelegramCode} className="w-12 h-12 rounded-xl bg-[var(--color-card-base)] border border-[var(--color-border-base)] flex items-center justify-center text-[var(--color-text-secondary)] active:scale-90 transition-transform">
                      <Copy size={18} />
                    </button>
                  </div>
                  {telegramCode.deepLink && (
                    <a
                      href={telegramCode.deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-[#229ED9] text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <Send size={14} /> Open Telegram
                    </a>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[13px] font-medium opacity-70 leading-relaxed">
                    Connect Telegram to log expenses in a chat and check your balance and budgets on the go.
                  </p>
                  <button
                    onClick={connectTelegram}
                    disabled={telegramLoading}
                    className="w-full py-3 rounded-xl bg-[#229ED9] text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    <Send size={14} /> {telegramLoading ? 'Generating…' : 'Connect Telegram'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Group>
  )
}
