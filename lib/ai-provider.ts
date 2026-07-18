import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { createHash } from 'node:crypto'

export type AIProvider = 'openai' | 'gemini'

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5.6-terra'
const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5.6-luna'
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'
const GEMINI_FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-2.5-flash'

function isConfigured(provider: AIProvider): boolean {
  return provider === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

export function getAvailableProviders(preferred: AIProvider): AIProvider[] {
  const fallback: AIProvider = preferred === 'openai' ? 'gemini' : 'openai'
  return [preferred, fallback].filter(isConfigured)
}

export function resolveProvider(preferred: AIProvider): AIProvider {
  const [provider] = getAvailableProviders(preferred)
  if (!provider) throw new Error('No AI provider is configured')
  return provider
}

// Used for the main chat — most capable model per provider
export function getChatModel(provider: AIProvider): LanguageModel {
  if (provider === 'openai') return openai(OPENAI_CHAT_MODEL) as unknown as LanguageModel
  return google(GEMINI_CHAT_MODEL) as unknown as LanguageModel
}

// Used for quick tasks: category suggestion, Telegram parsing
export function getFastModel(provider: AIProvider): LanguageModel {
  if (provider === 'openai') return openai(OPENAI_FAST_MODEL) as unknown as LanguageModel
  return google(GEMINI_FAST_MODEL) as unknown as LanguageModel
}

export function getAIProviderOptions(provider: AIProvider, userId: string) {
  if (provider !== 'openai') return undefined

  return {
    openai: {
      store: false,
      reasoningEffort: 'low',
      safetyIdentifier: createHash('sha256').update(userId).digest('hex'),
    },
  } as const
}

export async function withAIProviderFallback<T>(
  preferred: AIProvider,
  task: (provider: AIProvider) => Promise<T>
): Promise<{ result: T; provider: AIProvider }> {
  const providers = getAvailableProviders(preferred)
  if (providers.length === 0) throw new Error('No AI provider is configured')

  let lastError: unknown
  for (const provider of providers) {
    try {
      return { result: await task(provider), provider }
    } catch (error) {
      lastError = error
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      console.warn(`AI provider ${provider} failed (${errorName}); trying fallback`)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI service unavailable')
}
