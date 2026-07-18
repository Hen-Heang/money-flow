import { generateText, Output } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeAIRateLimit } from '@/lib/ai-rate-limit'
import {
  getAIProviderOptions,
  getFastModel,
  withAIProviderFallback,
  type AIProvider,
} from '@/lib/ai-provider'
import { CATEGORY_MATCH_GUIDANCE, formatCategoriesForPrompt } from '@/lib/categorize'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Category } from '@/lib/types'

const requestSchema = z.object({
  description: z.string().trim().min(2).max(120),
  type: z.enum(['income', 'expense']),
})

const suggestionSchema = z.object({
  categoryId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = requestSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid transaction description.' }, { status: 400 })

  const limit = await consumeAIRateLimit(user.id, 'category-suggest', 30, 60)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  const [userPrefResult, categoriesResult] = await Promise.all([
    supabase.from('users').select('ai_provider').eq('id', user.id).single(),
    supabase.from('categories').select('id, name, icon, color, type').order('name'),
  ])

  if (categoriesResult.error) {
    return NextResponse.json({ error: 'Could not load categories.' }, { status: 500 })
  }

  const availableCategories = ((categoriesResult.data || []) as Category[])
    .filter(category => category.type === body.data.type || category.type === 'both')
    .map(category => ({ id: category.id, name: category.name, icon: category.icon }))

  if (availableCategories.length === 0) return NextResponse.json({ categoryId: null })

  try {
    const { result } = await withAIProviderFallback(
      (userPrefResult.data?.ai_provider as AIProvider) || 'gemini',
      async provider => {
        const response = await generateText({
          model: getFastModel(provider),
          output: Output.object({ schema: suggestionSchema }),
          providerOptions: getAIProviderOptions(provider, user.id),
          system: `You categorize a transaction for a money tracking app.

Available categories (id: name):
${formatCategoriesForPrompt(availableCategories)}

${CATEGORY_MATCH_GUIDANCE}

Choose categoryId only from the supplied list. Use null if no category fits well.`,
          prompt: `Description: ${body.data.description}\nType: ${body.data.type}`,
        })
        return response.output
      }
    )

    const exists = availableCategories.some(category => category.id === result.categoryId)
    return NextResponse.json({
      categoryId: exists && result.confidence >= 0.45 ? result.categoryId : null,
    })
  } catch (error) {
    console.error('[category-suggest] AI failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }
}
