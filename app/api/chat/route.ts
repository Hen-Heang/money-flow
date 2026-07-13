import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getChatModel, resolveProvider, type AIProvider } from '@/lib/ai-provider'
import { FALLBACK_EXCHANGE_RATE } from '@/shared/presets'

// ── Rate limiter ─────────────────────────────────────────────────────────────
// In-memory sliding-window: 20 requests per user per minute
const RATE_LIMIT = 20
const WINDOW_MS = 60_000
const MAX_MESSAGES = 50
const MAX_MESSAGE_LENGTH = 2_000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true, retryAfter: 0 }
}

// Purge stale entries every 5 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(id)
  }
}, 5 * 60_000)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  // Rate limit check
  const { allowed, retryAfter } = checkRateLimit(user.id)
  if (!allowed) {
    return new Response(`Too many requests. Please wait ${retryAfter}s before trying again.`, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
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

  const tools = {
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
        "Get the user's transactions, optionally filtered by date range, type, or category name. Use this to answer questions about specific spending/income.",
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

    getSpendingSummary: tool({
      description:
        'Get aggregated income/expense totals and top spending categories for a date range. Good for overview questions.',
      inputSchema: z.object({
        from: z.string().optional().describe('Start date (YYYY-MM-DD), inclusive. Defaults to 3 months ago.'),
        to: z.string().optional().describe('End date (YYYY-MM-DD), inclusive. Defaults to today.'),
      }),
      execute: async ({ from, to }) => {
        const defaultFrom = new Date()
        defaultFrom.setMonth(defaultFrom.getMonth() - 3)
        const fromDate = from || defaultFrom.toISOString().split('T')[0]
        const toDate = to || new Date().toISOString().split('T')[0]

        const { data } = await supabase
          .from('transactions')
          .select('type, amount_krw, categories(name)')
          .eq('user_id', user.id)
          .gte('date', fromDate)
          .lte('date', toDate)

        const rows = data ?? []
        const totalIncome = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
        const totalExpense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)

        const catMap: Record<string, number> = {}
        rows
          .filter((t) => t.type === 'expense')
          .forEach((t) => {
            const cat = t.categories && !Array.isArray(t.categories) ? (t.categories as { name: string }) : null
            const name = cat?.name || 'Uncategorized'
            catMap[name] = (catMap[name] || 0) + t.amount_krw
          })

        return {
          from: fromDate,
          to: toDate,
          total_income_krw: totalIncome,
          total_expense_krw: totalExpense,
          net_balance_krw: totalIncome - totalExpense,
          savings_rate_pct: totalIncome > 0 ? Number(((1 - totalExpense / totalIncome) * 100).toFixed(1)) : 0,
          spending_by_category_krw: catMap,
          transaction_count: rows.length,
        }
      },
    }),

    getBudgets: tool({
      description:
        "Get the user's budgets per category along with how much they've actually spent in each category this month, so you can tell them if they're over or under budget.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: budgets } = await supabase
          .from('budgets')
          .select('amount_krw, categories(name)')
          .eq('user_id', user.id)

        const monthStart = new Date()
        monthStart.setDate(1)
        const fromDate = monthStart.toISOString().split('T')[0]

        const { data: spent } = await supabase
          .from('transactions')
          .select('amount_krw, categories(name)')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('date', fromDate)

        const spentByCategory: Record<string, number> = {}
        ;(spent ?? []).forEach((t) => {
          const cat = t.categories && !Array.isArray(t.categories) ? (t.categories as { name: string }) : null
          const name = cat?.name || 'Uncategorized'
          spentByCategory[name] = (spentByCategory[name] || 0) + t.amount_krw
        })

        return (budgets ?? []).map((b) => {
          const cat = b.categories && !Array.isArray(b.categories) ? (b.categories as { name: string }) : null
          const name = cat?.name || 'Uncategorized'
          const spentThisMonth = spentByCategory[name] || 0
          return {
            category: name,
            budget_krw: b.amount_krw,
            spent_this_month_krw: spentThisMonth,
            remaining_krw: b.amount_krw - spentThisMonth,
            over_budget: spentThisMonth > b.amount_krw,
          }
        })
      },
    }),

    getSavingsGoals: tool({
      description: "Get the user's savings goals and progress toward each.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .from('savings_goals')
          .select('name, target_usd, current_usd, deadline, auto_monthly_usd, purpose')
          .eq('user_id', user.id)

        return (data ?? []).map((g) => ({
          name: g.name,
          target_usd: g.target_usd,
          current_usd: g.current_usd,
          progress_pct: g.target_usd > 0 ? Number(((g.current_usd / g.target_usd) * 100).toFixed(1)) : 0,
          deadline: g.deadline,
          auto_monthly_usd: g.auto_monthly_usd,
          purpose: g.purpose,
        }))
      },
    }),

    suggestBudgetPlan: tool({
      description:
        "Analyze the user's expense history per category and propose a monthly budget for each, based on their average monthly spend. Use this when the user asks for help preparing/planning a budget. Always present the suggestions and ask for confirmation before calling applyBudgets.",
      inputSchema: z.object({
        months: z.number().int().min(1).max(12).optional().default(3).describe('How many past months of history to average over'),
      }),
      execute: async ({ months }) => {
        const from = new Date()
        from.setMonth(from.getMonth() - months)
        const fromDate = from.toISOString().split('T')[0]

        const { data: txns } = await supabase
          .from('transactions')
          .select('category_id, amount_krw, categories(name)')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('date', fromDate)
          .not('category_id', 'is', null)

        const { data: budgets } = await supabase
          .from('budgets')
          .select('category_id, amount_krw')
          .eq('user_id', user.id)

        const currentBudget = new Map((budgets ?? []).map((b) => [b.category_id, b.amount_krw]))

        const totals = new Map<string, { name: string; total: number }>()
        ;(txns ?? []).forEach((t) => {
          if (!t.category_id) return
          const cat = t.categories && !Array.isArray(t.categories) ? (t.categories as { name: string }) : null
          const entry = totals.get(t.category_id) || { name: cat?.name || 'Uncategorized', total: 0 }
          entry.total += t.amount_krw
          totals.set(t.category_id, entry)
        })

        return Array.from(totals.entries())
          .map(([categoryId, { name, total }]) => {
            const avgMonthly = total / months
            const suggested = Math.ceil(avgMonthly / 1000) * 1000
            return {
              category_id: categoryId,
              category_name: name,
              avg_monthly_spend_krw: Math.round(avgMonthly),
              current_budget_krw: currentBudget.get(categoryId) ?? 0,
              suggested_budget_krw: suggested,
            }
          })
          .sort((a, b) => b.avg_monthly_spend_krw - a.avg_monthly_spend_krw)
      },
    }),

    applyBudgets: tool({
      description:
        'Save monthly budget amounts for one or more categories. ONLY call this after the user has explicitly confirmed the specific amounts (e.g. "yes, apply that" or their own numbers) — never call it right after suggestBudgetPlan without confirmation.',
      inputSchema: z.object({
        budgets: z
          .array(
            z.object({
              category_id: z.string().describe('The category_id from suggestBudgetPlan or getBudgets'),
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
    system: `You are a friendly and insightful personal finance assistant for the Money Flow app.
Help users understand their spending habits, track budgets, and make smarter financial decisions.
Be concise, practical, and encouraging. Use bullet points for lists. Use ₩ for Korean Won and $ for USD.

If the user's message isn't about their finances, money, budgeting, or this app, do NOT answer the question
itself (no recipes, code, trivia, general advice, etc.) even if you know the answer. Instead reply with one
short, warm sentence redirecting to finance, e.g. "I'm just your finance assistant, so I can't help with that —
but I'd love to help you check your budget or spending!" Do this every time, no exceptions.
Today's date: ${today}

You have tools to look up the user's real transactions, spending summaries, budgets, savings goals, and the
current exchange rate — always call the relevant tool instead of guessing or estimating numbers. Never state
a specific amount, balance, or budget status unless it came from a tool result.

If the user wants help preparing or planning a budget, call suggestBudgetPlan, present the suggested amounts
per category clearly, and ask them to confirm before saving anything. Only call applyBudgets after they
explicitly confirm — if they want changes, adjust the numbers and confirm again before applying.`,
    tools,
    stopWhen: stepCountIs(5),
    messages,
  })

  return result.toTextStreamResponse()
}
