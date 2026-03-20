import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DEFAULT_GEMINI_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.5-flash'

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

  // Fetch last 3 months of transactions for context
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const fromDate = threeMonthsAgo.toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('transactions')
    .select('type, amount_krw, amount_usd, date, description, categories(name)')
    .eq('user_id', user.id)
    .gte('date', fromDate)
    .order('date', { ascending: false })

  const txList = transactions || []

  // Build financial summary
  const totalIncome = txList
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount_krw, 0)

  const totalExpense = txList
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount_krw, 0)

  const catMap: Record<string, number> = {}
  txList
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catRaw = t.categories
      const cat = catRaw && !Array.isArray(catRaw) ? (catRaw as { name: string }) : null
      const name = cat?.name || 'Uncategorized'
      catMap[name] = (catMap[name] || 0) + t.amount_krw
    })

  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amt]) => `${name}: ₩${amt.toLocaleString()}`)
    .join(', ')

  // Recent 5 transactions for context
  const recentTx = txList
    .slice(0, 5)
    .map((t) => {
      const catRaw = t.categories
      const cat = catRaw && !Array.isArray(catRaw) ? (catRaw as { name: string }) : null
      return `${t.date} | ${t.type} | ₩${t.amount_krw.toLocaleString()} | ${cat?.name || 'Uncategorized'} | ${t.description || ''}`
    })
    .join('\n')

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const financialContext =
    txList.length > 0
      ? `
User Financial Summary (last 3 months):
- Total Income: ₩${totalIncome.toLocaleString()} (~$${(totalIncome / 1350).toFixed(0)})
- Total Expenses: ₩${totalExpense.toLocaleString()} (~$${(totalExpense / 1350).toFixed(0)})
- Net Balance: ₩${(totalIncome - totalExpense).toLocaleString()}
- Savings Rate: ${totalIncome > 0 ? ((1 - totalExpense / totalIncome) * 100).toFixed(1) : 0}%
- Top Spending Categories: ${topCategories || 'None'}
- Total Transactions: ${txList.length}

Recent Transactions:
${recentTx}
`
      : 'No transaction data available yet.'

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey || apiKey === 'YOUR_GOOGLE_AI_API_KEY') {
    return new Response('Google AI API Key is missing. Please set GOOGLE_GENERATIVE_AI_API_KEY in your .env file.', { status: 500 })
  }

  const result = streamText({
    model: google(DEFAULT_GEMINI_MODEL),
    system: `You are a friendly and insightful personal finance assistant for the Money Flow app.
Help users understand their spending habits, track budgets, and make smarter financial decisions.
Be concise, practical, and encouraging. Use bullet points for lists. Use ₩ for Korean Won and $ for USD.
If the user asks something unrelated to finance, gently redirect them.
Today's date: ${today}

${financialContext}`,
    messages,
  })

  return result.toTextStreamResponse()
}
