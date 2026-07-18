import { NextResponse } from 'next/server'
import { z } from 'zod'
import { consumeAIRateLimit } from '@/lib/ai-rate-limit'
import {
  applyLearnedTransactionDefaults,
  parseTransactionText,
} from '@/lib/ai/transaction-parser'
import type { AIProvider } from '@/lib/ai-provider'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Category, PaymentMethod } from '@/lib/types'

const requestSchema = z.object({
  text: z.string().trim().min(3).max(300),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
})

interface HistoryRow {
  description: string
  type: 'income' | 'expense'
  category_id: string | null
  payment_method_id: string | null
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Enter a short transaction with an amount.' }, { status: 400 })
  }

  const limit = await consumeAIRateLimit(user.id, 'transaction-parse', 15, 60)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI requests. Please try again shortly.', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  const [userPrefResult, categoriesResult, paymentMethodsResult, historyResult] = await Promise.all([
    supabase.from('users').select('ai_provider').eq('id', user.id).single(),
    supabase.from('categories').select('id, name, icon, color, type').order('name'),
    supabase.from('payment_methods').select('id, name, icon').order('name'),
    supabase
      .from('transactions')
      .select('description, type, category_id, payment_method_id')
      .order('date', { ascending: false })
      .limit(300),
  ])

  if (categoriesResult.error || paymentMethodsResult.error) {
    return NextResponse.json({ error: 'Could not load transaction options.' }, { status: 500 })
  }

  const categories = (categoriesResult.data || []) as Category[]
  const paymentMethods = (paymentMethodsResult.data || []) as PaymentMethod[]
  const nowAtUserTimezone = new Date(
    Date.now() - parsedRequest.data.timezoneOffsetMinutes * 60_000
  )

  try {
    const preview = await parseTransactionText({
      text: parsedRequest.data.text,
      today: nowAtUserTimezone.toISOString().slice(0, 10),
      categories,
      paymentMethods,
      preferredProvider: (userPrefResult.data?.ai_provider as AIProvider) || 'gemini',
      userId: user.id,
    })

    const learnedPreview = applyLearnedTransactionDefaults(
      preview,
      (historyResult.data || []) as HistoryRow[],
      new Set(categories.map(category => category.id)),
      new Set(paymentMethods.map(method => method.id))
    )

    return NextResponse.json({ preview: learnedPreview })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error('[transaction-parse] AI parsing failed:', error instanceof Error ? error.name : 'UnknownError')
    const noProvider = message === 'No AI provider is configured'
    return NextResponse.json(
      { error: noProvider ? 'AI is not configured yet.' : 'I could not understand that transaction. Try including an amount.' },
      { status: noProvider ? 503 : 422 }
    )
  }
}
