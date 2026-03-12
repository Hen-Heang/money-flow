'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ChevronRight, Plus, RotateCcw, Send, Sparkles, User, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}

function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const viewport = window.visualViewport
    if (!viewport) return

    const update = () => setHeight(Math.round(viewport.height))

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)

    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return height
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded px-1 py-0.5 font-mono text-xs"
          style={{ background: 'var(--color-border-base)', color: 'var(--color-income-base)' }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    return part
  })
}

function MessageContent({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) return <span className="text-base leading-7">{text}</span>

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    if (/^[-*•]\s/.test(line)) {
      const bullets: string[] = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        bullets.push(lines[i].replace(/^[-*•]\s/, ''))
        i++
      }

      elements.push(
        <ul key={`ul-${i}`} className="my-1 space-y-1 pl-1">
          {bullets.map((bullet, index) => (
            <li key={index} className="flex gap-2">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: 'var(--color-accent-base)' }}
              />
              <span>{renderInline(bullet)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }

      elements.push(
        <ol key={`ol-${i}`} className="my-1 list-decimal space-y-1 pl-5">
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    if (/^#{1,3}\s/.test(line)) {
      elements.push(
        <p key={`h-${i}`} className="mt-2 font-semibold">
          {renderInline(line.replace(/^#{1,3}\s/, ''))}
        </p>,
      )
      i++
      continue
    }

    elements.push(
      <p key={`p-${i}`} className={i > 0 ? 'mt-1.5' : ''}>
        {renderInline(line)}
      </p>,
    )
    i++
  }

  return <div className="space-y-0.5 text-base leading-7">{elements}</div>
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

const SUGGESTIONS = [
  'Summarize this month in 3 bullets',
  'What category needs attention?',
  'How can I save more next month?',
  'Explain my recent spending pattern',
]

function AIBadge() {
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

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [panelTop, setPanelTop] = useState(72)
  const isMobile = useIsMobile()
  const viewportHeight = useVisualViewportHeight()
  const rootRef = useRef<HTMLDivElement>(null)
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

  const showSuggestions = messages.length === 0 && !isLoading
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
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            key="panel"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: -10, scale: 0.97 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: -8, scale: 0.97 }}
            transition={
              isMobile
                ? { type: 'spring', damping: 32, stiffness: 280 }
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
                    height: viewportHeight ? `${viewportHeight}px` : '100dvh',
                    background: 'var(--color-card-base)',
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
                  className="h-1 w-9 rounded-full"
                  style={{ background: 'var(--color-border-base)', opacity: 0.7 }}
                />
              </div>
            )}

            <div
              className="relative shrink-0 overflow-hidden px-4 pb-3 pt-3 sm:pb-4 sm:pt-4"
              style={{ borderBottom: '1px solid var(--color-border-base)' }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(80% 120% at 0% 0%, color-mix(in srgb, #3b82f6 14%, transparent), transparent 55%), radial-gradient(70% 100% at 100% 0%, color-mix(in srgb, #8b5cf6 12%, transparent), transparent 52%)',
                }}
              />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <AIBadge />
                  <div className="min-w-0">
                    <div
                      className="text-[11px] uppercase tracking-[0.26em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Finance assistant
                    </div>
                    <h2
                      className="truncate text-[15px] font-semibold sm:text-base"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Ask better money questions
                    </h2>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {hasMessages && (
                    <button
                      type="button"
                      onClick={clearMessages}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                      style={{
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border-base)',
                        background: 'var(--color-card-elevated-base)',
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Chat</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p
                className="relative mt-2 max-w-[34ch] text-[13px] leading-6 sm:mt-2.5 sm:text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Quick reads, spending explanations, and cleaner guidance for your monthly decisions.
              </p>

              {showSuggestions && (
                <div className="relative mt-3 grid grid-cols-1 gap-2 sm:mt-3.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => append(s)}
                      className="rounded-button px-3 py-2.5 text-left text-xs leading-5 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                      style={{
                        background: 'var(--color-card-elevated-base)',
                        border: '1px solid var(--color-border-base)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 sm:py-4">
              {!hasMessages ? (
                <div
                  className="rounded-[18px] p-4"
                  style={{
                    background: 'var(--color-card-elevated-base)',
                    border: '1px solid var(--color-border-base)',
                  }}
                >
                  <div
                    className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em]"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Start here
                  </div>
                  <p className="text-sm leading-6" style={{ color: 'var(--color-text-primary)' }}>
                    Try asking for a monthly summary, an explanation of unusual spending, or a simple action plan for next month.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isUser = message.role === 'user'
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <div
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                          >
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}

                        <div
                          className={`max-w-[84%] rounded-[18px] px-4 py-2.5 ${
                            isUser ? 'rounded-tr-md' : 'rounded-tl-md'
                          } ${message.error ? 'opacity-70' : ''}`}
                          style={
                            isUser
                              ? {
                                  background: 'linear-gradient(135deg, var(--color-accent-base), #1d4ed8)',
                                  color: '#eff6ff',
                                  boxShadow: '0 8px 20px rgba(29,78,216,0.22)',
                                }
                              : {
                                  background: 'var(--color-card-elevated-base)',
                                  border: '1px solid var(--color-border-base)',
                                  color: 'var(--color-text-primary)',
                                }
                          }
                        >
                          <MessageContent text={message.content} isUser={isUser} />

                          {message.error && (
                            <button
                              type="button"
                              onClick={retry}
                              className="mt-2 flex items-center gap-1.5 text-xs font-medium opacity-80 transition-opacity hover:opacity-100"
                              style={{ color: 'var(--color-accent-base)' }}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </button>
                          )}
                        </div>

                        {isUser && (
                          <div
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ background: 'linear-gradient(135deg, var(--color-accent-base), #1d4ed8)' }}
                          >
                            <User className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </motion.div>
                    )
                  })}

                  {showTyping && (
                    <div className="flex gap-2.5">
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                      >
                        <Bot className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div
                        className="flex items-center gap-1 rounded-[18px] rounded-tl-md px-4 py-3"
                        style={{
                          background: 'var(--color-card-elevated-base)',
                          border: '1px solid var(--color-border-base)',
                        }}
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: 'var(--color-accent-base)' }}
                            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div
              className="shrink-0 px-4 pt-2.5 sm:pt-3"
              style={{
                borderTop: '1px solid var(--color-border-base)',
                paddingBottom: isMobile
                  ? 'max(20px, env(safe-area-inset-bottom, 20px))'
                  : 'max(16px, env(safe-area-inset-bottom, 16px))',
              }}
            >
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about budget, savings, or spending..."
                  disabled={isLoading}
                  className="flex-1 rounded-button px-4 py-2.5 text-sm outline-none disabled:opacity-50"
                  style={{
                    background: 'var(--color-card-elevated-base)',
                    border: '1px solid var(--color-border-base)',
                    color: 'var(--color-text-primary)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e as unknown as React.FormEvent)
                    }
                  }}
                />
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.94 }}
                  disabled={isLoading || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-accent-base), #1d4ed8)',
                    boxShadow: '0 8px 20px rgba(37,99,235,0.28)',
                  }}
                >
                  <Send className="h-4 w-4 text-white" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  return (
    <div ref={rootRef} className="relative z-50">
      <motion.button
        ref={triggerRef}
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open AI finance assistant"
        className="flex items-center gap-2 rounded-[12px] px-1.5 py-1 sm:gap-3 sm:rounded-[18px] sm:px-3 sm:py-2"
        style={{
          background: 'var(--color-card-base)',
          border: '1px solid var(--color-border-base)',
          boxShadow: open
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
            AI Chat Assistant
            <ChevronRight
              className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
              style={{ color: 'var(--color-text-secondary)' }}
            />
          </div>
        </div>
      </motion.button>

      {typeof document !== 'undefined' ? createPortal(overlay, document.body) : null}
    </div>
  )
}
