'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Bot, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { MessageResponse } from '@/components/ai-elements/message'
import { useIsMobile } from '@/hooks/useIsMobile'
import { AIBadge, ChatLauncher } from './ChatLauncher'


function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height))

    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  return offset
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

function useStreamingChat(api: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const append = useCallback(
    async (userContent: string) => {
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userContent }
      const assistantId = `a-${Date.now()}`
      const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' }

      const history = [...messagesRef.current, userMsg]
      setMessages([...history, assistantMsg])
      setIsLoading(true)

      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        })

        if (res.status === 401) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Please sign in again to use the AI assistant.', error: true }
                : m,
            ),
          )
          return
        }

        if (!res.ok || !res.body) {
          throw new Error('Request failed')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          )
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Something went wrong. Tap retry to try again.', error: true }
              : m,
          ),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [api],
  )

  const retry = useCallback(() => {
    const msgs = messagesRef.current
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return

    const cleaned = msgs.filter((m) => !(m.role === 'assistant' && m.error))
    setMessages(cleaned.filter((m) => m.id !== lastUserMsg.id))
    append(lastUserMsg.content)
  }, [append])

  const clearMessages = useCallback(() => {
    setMessages([])
    setInput('')
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isLoading) return
      setInput('')
      append(text)
    },
    [append, input, isLoading],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }, [])

  return { append, clearMessages, retry, handleInputChange, handleSubmit, input, isLoading, messages }
}

const PAGE_SUGGESTIONS: Record<string, { label: string; prompt: string }[]> = {
  '/': [
    { label: 'Monthly summary', prompt: 'Summarize my spending this month in 3 bullets' },
    { label: 'Budget check', prompt: 'Am I on track with my budgets this month?' },
    { label: 'End-of-month forecast', prompt: 'Based on my daily average, how much will I spend by month end?' },
    { label: 'Top category', prompt: 'Which spending category needs my attention most right now?' },
    { label: 'Save more', prompt: 'Give me 3 practical tips to save more this month' },
    { label: 'Balance insight', prompt: 'Is my current income vs expense ratio healthy?' },
  ],
  '/transactions': [
    { label: 'Unusual spending', prompt: 'Are there any unusual or unexpected transactions this month?' },
    { label: 'Categorize tips', prompt: 'Which of my transactions might be miscategorized?' },
    { label: 'Daily average', prompt: 'What is my daily spending average and is it sustainable?' },
    { label: 'Recurring costs', prompt: 'What recurring expenses do I have and can any be reduced?' },
    { label: 'Weekend vs weekday', prompt: 'Do I spend more on weekends or weekdays?' },
    { label: 'Cash flow', prompt: 'Explain my cash flow trend over the past few weeks' },
  ],
  '/savings': [
    { label: 'Goal progress', prompt: 'How are my savings goals progressing — am I on pace?' },
    { label: 'Boost savings', prompt: 'How much extra could I realistically save each month?' },
    { label: 'Goal timeline', prompt: 'Which savings goal will I reach first at my current rate?' },
    { label: 'Auto-deposit advice', prompt: 'What monthly auto-deposit amount would make sense for my goals?' },
    { label: 'Priority goals', prompt: 'Which savings goal should I prioritize and why?' },
    { label: 'Save faster', prompt: 'What expenses could I cut to reach my savings goals faster?' },
  ],
  '/analytics': [
    { label: 'Trend analysis', prompt: 'What spending trends stand out in my analytics?' },
    { label: 'Month comparison', prompt: 'How does this month compare to my 3-month average?' },
    { label: 'Budget gaps', prompt: 'Which categories are consistently over or under budget?' },
    { label: 'Income stability', prompt: 'How stable is my income over the past 6 months?' },
    { label: 'Category deep-dive', prompt: 'Break down my top spending category in detail' },
    { label: 'Net worth trend', prompt: 'Is my overall financial health improving over time?' },
  ],
}

const DEFAULT_SUGGESTIONS = PAGE_SUGGESTIONS['/']

function useContextSuggestions() {
  const pathname = usePathname()
  // Match the base route segment (e.g. /analytics/detail → /analytics)
  const base = '/' + (pathname?.split('/').filter(Boolean)[0] ?? '')
  return PAGE_SUGGESTIONS[base] ?? DEFAULT_SUGGESTIONS
}

interface ChatBotProps {
  initialOpen?: boolean
}

export default function ChatBot({ initialOpen = false }: ChatBotProps) {
  const [open, setOpen] = useState(initialOpen)
  const [panelTop, setPanelTop] = useState(72)
  const isMobile = useIsMobile()
  const keyboardOffset = useKeyboardOffset()
  const rootRef = useRef<HTMLDivElement>(null)
  const suggestions = useContextSuggestions()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, append, clearMessages, retry } =
    useStreamingChat('/api/chat')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(() => inputRef.current?.focus(), 180)
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      const isInsideTrigger = rootRef.current?.contains(target)
      const isInsidePanel = panelRef.current?.contains(target)

      if (!isInsideTrigger && !isInsidePanel) {
        setOpen(false)
      }
    }

    if (!isMobile) {
      window.addEventListener('mousedown', handleMouseDown)
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      if (!isMobile) {
        window.removeEventListener('mousedown', handleMouseDown)
      }
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMobile, open])

  useEffect(() => {
    if (!open || isMobile) return

    const updatePanelPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPanelTop(Math.round(rect.bottom + 12))
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isMobile, open])

  useEffect(() => {
    if (!open || !isMobile || typeof document === 'undefined') return

    const body = document.body
    const html = document.documentElement
    const scrollY = window.scrollY
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyWidth = body.style.width
    const previousHtmlOverflow = html.style.overflow

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.width = previousBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [isMobile, open])

  const hasMessages = messages.length > 0
  const lastMessage = messages[messages.length - 1]
  const showTyping = isLoading && lastMessage?.role === 'assistant' && lastMessage?.content === ''
  const overlay = (
    <>
      <AnimatePresence>
        {open && !isMobile && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-90"
            style={{
              background: 'rgba(2,6,23,0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id="money-ai-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Money AI finance assistant"
            key="panel"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: -10, scale: 0.97 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: -8, scale: 0.97 }}
            transition={
              isMobile
                ? { type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }
                : { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }
            }
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_, info) => {
              if (isMobile && info.offset.y > 80) setOpen(false)
            }}
            className={`z-[100] flex flex-col overflow-hidden ${
              isMobile ? 'fixed inset-0' : 'fixed right-4 rounded-[24px] md:right-6 lg:right-8'
            }`}
            style={
              isMobile
                ? {
                    background: 'var(--color-bg)',
                    willChange: 'transform',
                  }
                : {
                    width: 'min(calc(100vw - 32px), 420px)',
                    maxHeight: 'min(76vh, 680px)',
                    top: `${panelTop}px`,
                    background: 'var(--color-card-base)',
                    border: '1px solid var(--color-border-base)',
                    boxShadow: '0 28px 80px rgba(2,6,23,0.42)',
                  }
            }
          >
            {isMobile && (
              <div
                className="flex shrink-0 justify-center pb-1 pt-3"
                style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
              >
                <div
                  className="h-1.5 w-10 rounded-full"
                  style={{ background: 'var(--color-border-base)', opacity: 0.5 }}
                />
              </div>
            )}

            <div
              className="relative shrink-0 overflow-hidden px-5 pb-4 pt-3"
              style={{ borderBottom: '1px solid var(--color-border-base)' }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(80% 120% at 0% 0%, color-mix(in srgb, #3b82f6 14%, transparent), transparent 55%), radial-gradient(70% 100% at 100% 0%, color-mix(in srgb, #8b5cf6 12%, transparent), transparent 52%)',
                }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AIBadge />
                  <div className="min-w-0">
                    <div
                      className="text-[10px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Finance assistant
                    </div>
                    <h2
                      className="truncate text-lg font-black tracking-tight"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Money AI
                    </h2>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {hasMessages && (
                    <button
                      type="button"
                      onClick={clearMessages}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)] active:scale-90 transition-transform"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)] active:scale-90 transition-transform"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!hasMessages ? (
                <div className="flex h-full flex-col justify-end px-4 pb-4 pt-6">
                  {/* Greeting */}
                  <div className="mb-6 flex flex-col items-center gap-3 text-center">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                    >
                      <Bot className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>How can I help you?</p>
                      <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ask about your finances or pick a suggestion</p>
                    </div>
                  </div>

                  {/* Suggestion chips */}
                  <div className="grid grid-cols-2 gap-2">
                    {suggestions.map(({ label, prompt }) => (
                      <motion.button
                        key={label}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => append(prompt)}
                        className="flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium"
                        style={{
                          background: 'var(--color-card-elevated-base)',
                          border: '1px solid var(--color-border-base)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent-base)' }} />
                        <span className="leading-snug">{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 px-4 py-4">
                  {messages.map((message) => {
                    const isUser = message.role === 'user'
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                      >
                        {isUser ? (
                          /* User message — pill aligned right */
                          <div className="flex justify-end py-1">
                            <div
                              className="max-w-[78%] rounded-[20px] rounded-tr-md px-4 py-2.5"
                              style={{
                                background: 'linear-gradient(135deg, var(--color-accent-base), #1d4ed8)',
                                color: '#eff6ff',
                                boxShadow: '0 4px 16px rgba(29,78,216,0.22)',
                              }}
                            >
                              <span className="text-base leading-7">{message.content}</span>
                            </div>
                          </div>
                        ) : (
                          /* AI message — card background on desktop, plain on mobile */
                          <div
                            className={`py-3 ${message.error ? 'opacity-70' : ''} ${!isMobile ? 'px-3 rounded-2xl' : ''}`}
                            style={!isMobile ? {
                              background: 'var(--color-card-elevated-base)',
                              border: '1px solid var(--color-border-base)',
                            } : undefined}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                              >
                                <Bot className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                Money AI
                              </span>
                            </div>
                            <div className="pl-8" style={{ color: 'var(--color-text-primary)' }}>
                              <MessageResponse
                                isAnimating={isLoading && message.id === lastMessage?.id}
                                className="text-base leading-7 [&_a]:text-[var(--color-accent-base)] [&_li]:text-base [&_li]:leading-7 [&_p]:text-base [&_p]:leading-7 [&_span]:text-[inherit]"
                              >
                                {message.content}
                              </MessageResponse>
                              {message.error && (
                                <button
                                  type="button"
                                  onClick={retry}
                                  className="mt-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                                  style={{ color: 'var(--color-accent-base)' }}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}

                  {showTyping && (
                    <div className="py-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                        >
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                          Money AI
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pl-8">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-2 w-2 rounded-full"
                            style={{ background: 'var(--color-accent-base)' }}
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} className="h-2" />
                </div>
              )}
            </div>

            {/* Input bar */}
            <div
              className={`shrink-0 ${isMobile ? 'glass-ios' : ''}`}
              style={{
                borderTop: '1px solid var(--color-border-base)',
                background: !isMobile ? 'var(--color-card-base)' : undefined,
                paddingBottom: isMobile && keyboardOffset > 0
                  ? `${keyboardOffset + 12}px`
                  : isMobile
                    ? 'max(20px, env(safe-area-inset-bottom, 20px))'
                    : '16px',
              }}
            >
              {/* Suggestions strip when chatting */}
              {hasMessages && !isLoading && (
                <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                  {suggestions.slice(0, 4).map(({ label, prompt }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => append(prompt)}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap"
                      style={{
                        background: 'var(--color-card-elevated-base)',
                        border: '1px solid var(--color-border-base)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 pt-2">
                <div
                  className="flex flex-1 items-end gap-2 rounded-[20px] px-4 py-2"
                  style={{
                    background: 'var(--color-card-elevated-base)',
                    border: '1.5px solid var(--color-border-base)',
                  }}
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Message Money AI..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent py-1 text-[15px] font-medium outline-none disabled:opacity-50 placeholder:opacity-40"
                    style={{ color: 'var(--color-text-primary)' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e as unknown as React.FormEvent)
                      }
                    }}
                  />
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.88 }}
                    disabled={isLoading || !input.trim()}
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30 transition-opacity"
                    style={{
                      background: input.trim()
                        ? 'linear-gradient(135deg, var(--color-accent-base), #1d4ed8)'
                        : 'var(--color-border-base)',
                    }}
                  >
                    <Send className="h-4 w-4 text-white" />
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  return (
    <div ref={rootRef} className="relative z-50">
      <ChatLauncher
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        expanded={open}
      />

      {typeof document !== 'undefined' ? createPortal(overlay, document.body) : null}
    </div>
  )
}
