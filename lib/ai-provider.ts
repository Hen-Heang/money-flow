import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export type AIProvider = 'openai' | 'gemini'

export function resolveProvider(preferred: AIProvider): AIProvider {
  if (preferred === 'openai' && process.env.OPENAI_API_KEY) return 'openai'
  if (preferred === 'gemini' && process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'gemini'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'gemini'
}

// Used for the main chat — most capable model per provider
export function getChatModel(provider: AIProvider): LanguageModel {
  if (provider === 'openai') return openai('gpt-4o') as unknown as LanguageModel
  return google('gemini-2.5-flash') as unknown as LanguageModel
}

// Used for quick tasks: category suggestion, Telegram parsing
export function getFastModel(provider: AIProvider): LanguageModel {
  if (provider === 'openai') return openai('gpt-4o-mini') as unknown as LanguageModel
  return google('gemini-1.5-flash') as unknown as LanguageModel
}
