'use client'

import { forwardRef } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'

interface ChatLauncherProps {
  expanded?: boolean
  loading?: boolean
  onClick?: () => void
}

export function AIBadge() {
  return (
    <div
      className="relative h-8 w-8 shrink-0 overflow-hidden rounded-button sm:h-10 sm:w-10"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, #8b5cf6 22%, var(--color-card-elevated-base)), color-mix(in srgb, #3b82f6 18%, var(--color-card-elevated-base)))',
        border: '1px solid color-mix(in srgb, var(--color-border-base) 80%, #8b5cf6 20%)',
        boxShadow: '0 10px 28px rgba(59,130,246,0.18)',
      }}
    >
      <div
        className="absolute inset-x-1.5 bottom-1.5 top-1.5 rounded-[10px] sm:inset-x-2 sm:bottom-2 sm:top-2"
        style={{
          border: '2px solid transparent',
          borderColor: 'rgba(168,85,247,0.9)',
          borderTopColor: 'rgba(59,130,246,0.95)',
          borderRightColor: 'rgba(59,130,246,0.95)',
        }}
      />
      <div
        className="absolute bottom-[5px] left-[8px] text-[15px] font-semibold tracking-[-0.08em] sm:bottom-[7px] sm:left-[11px] sm:text-[19px]"
        style={{
          background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        Ai
      </div>
      <Sparkles
        className="absolute right-1 top-1 h-3 w-3 sm:h-3.5 sm:w-3.5"
        style={{ color: '#3b82f6' }}
      />
    </div>
  )
}

export const ChatLauncher = forwardRef<HTMLButtonElement, ChatLauncherProps>(
  function ChatLauncher(
    { expanded = false, loading = false, onClick },
    ref,
  ) {
    const label = loading
      ? 'Loading AI finance assistant'
      : expanded
        ? 'Close AI finance assistant'
        : 'Open AI finance assistant'

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading || undefined}
        aria-controls="money-ai-panel"
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={label}
        className="flex items-center gap-2 rounded-[12px] px-1.5 py-1 transition-transform hover:-translate-y-px active:scale-[0.98] disabled:cursor-wait sm:gap-3 sm:rounded-[18px] sm:px-3 sm:py-2"
        style={{
          background: 'var(--color-card-base)',
          border: '1px solid var(--color-border-base)',
          boxShadow: expanded
            ? '0 16px 40px rgba(5,10,22,0.28), 0 0 0 1px color-mix(in srgb, #8b5cf6 28%, transparent)'
            : '0 8px 24px rgba(5,10,22,0.16)',
        }}
      >
        <AIBadge />
        <div className="hidden min-w-0 text-left sm:block">
          <div
            className="text-xs uppercase tracking-[0.28em]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Money Flow
          </div>
          <div
            className="mt-0.5 flex items-center gap-1 text-base font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {loading ? 'Loading AI...' : 'AI Chat Assistant'}
            <ChevronRight
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              style={{ color: 'var(--color-text-secondary)' }}
            />
          </div>
        </div>
      </button>
    )
  },
)
