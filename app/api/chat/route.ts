import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { consumeAIRateLimit } from '@/lib/ai-rate-limit'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAIProviderOptions, getChatModel, resolveProvider, type AIProvider } from '@/lib/ai-provider'
import { createFinanceChatTools } from '@/lib/finance/chat-tools'
import { FALLBACK_EXCHANGE_RATE } from '@/shared/presets'

const RATE_LIMIT = 20
const MAX_MESSAGES = 50
const MAX_MESSAGE_LENGTH = 2_000

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  // Rate limit check
  const { allowed, retryAfterSeconds } = await consumeAIRateLimit(user.id, 'chat', RATE_LIMIT, 60)
  if (!allowed) {
    return new Response(`Too many requests. Please wait ${retryAfterSeconds}s before trying again.`, {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    })
  }

  const body = await req.json()
  const { messages } = body

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages must be a non-empty array', { status: 400 })
  }
  if (messages.length > MAX_MESSAGES) {
    return new Response(`Conversation too long. Maximum ${MAX_MESSAGES} messages allowed.`, { status: 400 })
  }
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') return new Response('Invalid message format', { status: 400 })
    if (msg.role !== 'user' && msg.role !== 'assistant') return new Response('Invalid message role', { status: 400 })
    if (typeof msg.content !== 'string') return new Response('Message content must be a string', { status: 400 })
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return new Response(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters per message.`, { status: 400 })
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const { data: userPref } = await supabase.from('users').select('ai_provider').eq('id', user.id).single()
  const provider = resolveProvider((userPref?.ai_provider as AIProvider) || 'gemini')

  // Engine-backed tools: every figure comes from lib/finance/analysis, so the
  // model never performs financial arithmetic itself.
  const financeTools = createFinanceChatTools(supabase, user.id)

  const tools = {
    ...financeTools,

    getExchangeRate: tool({
      description: 'Get the current KRW-per-USD exchange rate to convert between currencies.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .from('exchange_rates')
          .select('rate, fetched_at')
          .eq('base_currency', 'USD')
          .eq('target_currency', 'KRW')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .single()
        return data ?? { rate: FALLBACK_EXCHANGE_RATE, fetched_at: null, note: 'fallback rate, no cached rate found' }
      },
    }),

    getTransactions: tool({
      description:
        "Look up individual transactions, optionally filtered by date range, type, or category name. Use this only when the user asks about specific purchases — for totals and summaries use getFinancialSummary or getCategorySpending instead.",
      inputSchema: z.object({
        from: z.string().optional().describe('Start date (YYYY-MM-DD), inclusive'),
        to: z.string().optional().describe('End date (YYYY-MM-DD), inclusive'),
        type: z.enum(['income', 'expense']).optional(),
        categoryName: z.string().optional().describe('Filter to a specific category name (case-insensitive)'),
        limit: z.number().int().min(1).max(200).optional().default(100),
      }),
      execute: async ({ from, to, type, categoryName, limit }) => {
        let query = supabase
          .from('transactions')
          .select('type, amount_krw, amount_usd, date, description, categories(name)')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(limit)

        if (from) query = query.gte('date', from)
        if (to) query = query.lte('date', to)
        if (type) query = query.eq('type', type)

        const { data } = await query
        let rows = data ?? []
        if (categoryName) {
          const needle = categoryName.toLowerCase()
          rows = rows.filter((t) => {
            const cat = t.categories && !Array.isArray(t.categories) ? (t.categories as { name: string }) : null
            return (cat?.name || 'uncategorized').toLowerCase().includes(needle)
          })
        }
        return rows.map((t) => ({
          date: t.date,
          type: t.type,
          amount_krw: t.amount_krw,
          amount_usd: t.amount_usd,
          category:
            (t.categories && !Array.isArray(t.categories) ? (t.categories as { name: string }).name : null) ||
            'Uncategorized',
          description: t.description,
        }))
      },
    }),

    applyBudgets: tool({
      description:
        'Save monthly budget amounts for one or more categories. ONLY call this after the user has explicitly confirmed the specific amounts (e.g. "yes, apply that" or their own numbers) — never call it right after suggestBudgetPlan without confirmation.',
      inputSchema: z.object({
        budgets: z
          .array(
            z.object({
              category_id: z.string().describe('The categoryId from suggestBudgetPlan or getBudgetStatus'),
              amount_krw: z.number().min(0),
            }),
          )
          .min(1),
      }),
      execute: async ({ budgets }) => {
        const rows = budgets.map((b) => ({
          user_id: user.id,
          category_id: b.category_id,
          amount_krw: b.amount_krw,
          updated_at: new Date().toISOString(),
        }))

        const { error } = await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category_id' })
        if (error) {
          console.error('[api/chat] applyBudgets upsert failed:', error)
          return { success: false, error: error.message }
        }
        return { success: true, updated: budgets.length }
      },
    }),
  }

  const result = streamText({
    model: getChatModel(provider),
    providerOptions: getAIProviderOptions(provider, user.id),
    system: `You are a friendly and insightful personal finance assistant for the Money Flow app.
Help users understand their spending habits, track budgets, and make smarter financial decisions.
Be concise, practical, and encouraging. Use bullet points for lists. Use ₩ for Korean Won and $ for USD.

If the user's message isn't about their finances, money, budgeting, or this app, do NOT answer the question
itself (no recipes, code, trivia, general advice, etc.) even if you know the answer. Instead reply with one
short, warm sentence redirecting to finance, e.g. "I'm just your finance assistant, so I can't help with that —
but I'd love to help you check your budget or spending!" Do this every time, no exceptions.
Today's date: ${today}

NUMBERS RULE — this is absolute:
Every amount, percentage, projection, or date you state must come from a tool result. Never add, subtract,
divide, average, or project figures yourself, and never estimate. If you need a number you don't have, call
the tool that provides it. If no tool provides it, say you don't have that figure rather than guessing.

Tools you have:
- getFinancialSummary — the verified snapshot for this month (income, expenses, savings rate, pace, budgets, goals)
- compareMonths — two months side by side
- getCategorySpending — spending by category for a date range
- getBudgetStatus — budget usage, projections, and how much is safe to spend for the rest of the month
- getSubscriptions — detected recurring payments and their yearly cost
- getSavingsGoalPlan — planned vs required monthly contribution, projected completion, on-track status
- simulateBudget — "what if I set X to Y" (simulation only, saves nothing)
- suggestBudgetPlan — adaptive per-category budget recommendations with rationale
- getRecentInsights — the AI Money Coach insights already shown to the user
- getTransactions — individual transactions, for questions about specific purchases
- getExchangeRate — current KRW/USD rate
- applyBudgets — saves budgets (requires explicit confirmation first)

Tone: calm, supportive, and non-judgemental. Never say the user was bad, failed, or wasted money. Prefer
phrasing like "this category exceeded its plan", "here is one adjustment you could try", or "this expense may
be worth reviewing".

Budget changes: if the user wants help planning a budget, call suggestBudgetPlan, present the amounts and the
reasoning per category, and ask them to confirm. Only call applyBudgets after they explicitly confirm — if they
want changes, adjust and confirm again before applying.

Subscriptions: you can point out recurring payments worth reviewing, but never suggest anything has been or
will be cancelled automatically. The user decides and cancels with the provider themselves.

Savings goals: never imply a balance changed. Contributions only count once the user confirms them in the app.`,
    tools,
    stopWhen: stepCountIs(6),
    messages,
  })

  return result.toTextStreamResponse()
}
