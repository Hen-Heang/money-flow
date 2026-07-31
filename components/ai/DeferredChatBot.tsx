'use client'

import { useState, type ComponentType } from 'react'
import { ChatLauncher } from './ChatLauncher'

type ChatBotComponent = ComponentType<{ initialOpen?: boolean }>

export default function DeferredChatBot() {
  const [ChatBot, setChatBot] = useState<ChatBotComponent | null>(null)
  const [loading, setLoading] = useState(false)

  if (ChatBot) {
    return <ChatBot initialOpen />
  }

  const loadChat = async () => {
    if (loading) return
    setLoading(true)

    try {
      const chatModule = await import('./ChatBot')
      setChatBot(() => chatModule.default)
    } catch {
      setLoading(false)
    }
  }

  return (
    <ChatLauncher
      expanded={loading}
      loading={loading}
      onClick={() => { void loadChat() }}
    />
  )
}
