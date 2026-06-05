import { NextRequest, NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createTelegramServiceClient, sendTelegramMessage, escapeHtml, fmtKRW } from '@/lib/telegram'
import { FALLBACK_EXCHANGE_RATE } from '@/shared/presets'
import { rateLimit } from '@/lib/rate-limit'

// Telegram delivers updates here as POST requests (webhook mode).
// Secured by the secret token Telegram echoes back in a header — set when
// the webhook is registered (see /api/telegram/setup).

const DEFAULT_GEMINI_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-1.5-flash'

type ServiceClient = NonNullable<ReturnType<typeof createTelegramServiceClient>>

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    from?: { first_name?: string }
    text?: string
  }
}

const HELP_TEXT = [
  '<b>Money Flow Bot</b> 💸',
  '',
  'Just type what you spent and I\'ll log it:',
  '• <code>coffee 4500</code>',
  '• <code>lunch 12000 food</code>',
  '• <code>salary 3000000 income</code>',
  '',
  '<b>Commands</b>',
  '/balance — current balance',
  '/today — today\'s spending',
  '/budget — this month\'s budget status',
  '/link &lt;code&gt; — connect your account',
  '/unlink — disconnect this chat',
  '/help — show this message',
].join('\n')

// ── Currency ─────────────────────────────────────────────────────────────────

async function getUsdKrwRate(supabase: ServiceClient): Promise<number> {
  const { data } = await supabase
    .from('exchange_rates')
    .select('rate')
    .eq('base_currency', 'USD')
    .eq('target_currency', 'KRW')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const rate = Number(data?.rate)
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_EXCHANGE_RATE
}

// ── Account lookup / linking ──────────────────────────────────────────────────

async function getUserIdForChat(supabase: ServiceClient, chatId: number): Promise<string | null> {
  const { data } = await supabase
    .from('telegram_accounts')
    .select('user_id')
    .eq('chat_id', chatId)
    .maybeSingle()
  return data?.user_id ?? null
}

async function handleLink(supabase: ServiceClient, chatId: number, rawCode: string): Promise<string> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return 'Please include your code, e.g. <code>/link ABC123</code>. Generate one in Money Flow → Settings → Connect Telegram.'

  const { data: account } = await supabase
    .from('telegram_accounts')
    .select('user_id, link_code_expires_at')
    .eq('link_code', code)
    .maybeSingle()

  if (!account) return '❌ That code is invalid. Open Money Flow → Settings → Connect Telegram to get a fresh one.'
  if (account.link_code_expires_at && new Date(account.link_code_expires_at) < new Date()) {
    return '⌛ That code has expired. Generate a new one in Money Flow → Settings → Connect Telegram.'
  }

  // Ensure this chat isn't already bound to a different user.
  await supabase.from('telegram_accounts').update({ chat_id: null }).eq('chat_id', chatId)

  const { error } = await supabase
    .from('telegram_accounts')
    .update({
      chat_id: chatId,
      linked_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', account.user_id)

  if (error) {
    console.error('[telegram] link update error:', error)
    return '❌ Something went wrong linking your account. Please try again.'
  }
  return '✅ <b>Connected!</b> You can now log expenses by typing them here. Try <code>coffee 4500</code> or send /help.'
}

// ── Read commands ──────────────────────────────────────────────────────────────

async function handleBalance(supabase: ServiceClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('transactions')
    .select('type, amount_krw')
    .eq('user_id', userId)

  if (!data || data.length === 0) return 'No transactions yet. Type something like <code>coffee 4500</code> to get started.'

  let income = 0
  let expense = 0
  for (const t of data) {
    if (t.type === 'income') income += Number(t.amount_krw) || 0
    else expense += Number(t.amount_krw) || 0
  }
  const balance = income - expense
  return [
    `<b>Balance:</b> ${fmtKRW(balance)}`,
    `📈 Income: ${fmtKRW(income)}`,
    `📉 Expense: ${fmtKRW(expense)}`,
  ].join('\n')
}

async function handleToday(supabase: ServiceClient, userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('transactions')
    .select('amount_krw, description, categories(icon)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (!data || data.length === 0) return '🎉 No spending logged today yet.'

  const total = data.reduce((s, t) => s + (Number(t.amount_krw) || 0), 0)
  const lines = data.slice(0, 15).map((t) => {
    const icon = (t.categories as { icon?: string } | null)?.icon || '•'
    return `${icon} ${escapeHtml(t.description)} — ${fmtKRW(Number(t.amount_krw) || 0)}`
  })
  return [`<b>Today:</b> ${fmtKRW(total)} spent`, '', ...lines].join('\n')
}

async function handleBudget(supabase: ServiceClient, userId: string): Promise<string> {
  const now = new Date()
  const monthStart = `${now.toISOString().slice(0, 7)}-01`

  const [budgetsRes, txRes] = await Promise.all([
    supabase.from('budgets').select('category_id, amount_krw, categories(name, icon)').eq('user_id', userId),
    supabase
      .from('transactions')
      .select('category_id, amount_krw')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', monthStart),
  ])

  const budgets = budgetsRes.data ?? []
  if (budgets.length === 0) return 'No budgets set yet. Add them in Money Flow → Settings → Monthly Budgets.'

  const spentByCat = new Map<string, number>()
  for (const t of txRes.data ?? []) {
    if (!t.category_id) continue
    spentByCat.set(t.category_id, (spentByCat.get(t.category_id) || 0) + (Number(t.amount_krw) || 0))
  }

  const lines = budgets
    .filter((b) => Number(b.amount_krw) > 0)
    .map((b) => {
      const cat = b.categories as { name?: string; icon?: string } | null
      const limit = Number(b.amount_krw)
      const spent = spentByCat.get(b.category_id) || 0
      const pct = Math.round((spent / limit) * 100)
      const flag = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢'
      return `${flag} ${cat?.icon || ''} ${escapeHtml(cat?.name || 'Category')}: ${fmtKRW(spent)} / ${fmtKRW(limit)} (${pct}%)`
    })

  if (lines.length === 0) return 'No budgets set yet. Add them in Money Flow → Settings → Monthly Budgets.'
  return [`<b>Budget — ${now.toLocaleString('en-US', { month: 'long' })}</b>`, '', ...lines].join('\n')
}

// ── AI expense logging ──────────────────────────────────────────────────────────

interface ParsedTransaction {
  amount: number
  currency: 'KRW' | 'USD'
  type: 'income' | 'expense'
  description: string
  category_id: string | null
}

async function parseTransaction(
  text: string,
  categories: Array<{ id: string; name: string; type: string }>,
): Promise<ParsedTransaction | null> {
  const catList = categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))

  const { text: raw } = await generateText({
    model: google(DEFAULT_GEMINI_MODEL),
    system: `You parse a single short message into a money transaction for a tracking app.
Default currency is KRW (Korean won) unless the user clearly writes USD or a $ sign.
Treat the transaction as "expense" unless the message clearly describes earning money (salary, refund, income, deposit) — then "income".
Pick the best matching category id from this list, or null if none fit: ${JSON.stringify(catList)}
Respond with ONLY a JSON object, no markdown, in this exact shape:
{"amount": <positive number>, "currency": "KRW"|"USD", "type": "income"|"expense", "description": <short string>, "category_id": <id string or null>}
If there is no clear amount, respond with {"amount": 0}.`,
    prompt: text,
  })

  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned) as Partial<ParsedTransaction>
    const amount = Number(parsed.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null

    const currency: 'KRW' | 'USD' = parsed.currency === 'USD' ? 'USD' : 'KRW'
    const type: 'income' | 'expense' = parsed.type === 'income' ? 'income' : 'expense'
    const description = String(parsed.description || text).trim().slice(0, 200) || 'Transaction'
    const category_id =
      typeof parsed.category_id === 'string' && categories.some((c) => c.id === parsed.category_id)
        ? parsed.category_id
        : null

    return { amount, currency, type, description, category_id }
  } catch {
    return null
  }
}

async function handleLogExpense(supabase: ServiceClient, userId: string, text: string): Promise<string> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('user_id', userId)

  const parsed = await parseTransaction(text, categories ?? [])
  if (!parsed) {
    return "I couldn't read an amount there. Try something like <code>coffee 4500</code> or <code>lunch 12000 food</code>."
  }

  const rate = await getUsdKrwRate(supabase)
  const amount_krw = parsed.currency === 'KRW' ? parsed.amount : parsed.amount * rate
  const amount_usd = parsed.currency === 'USD' ? parsed.amount : parsed.amount / rate

  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type: parsed.type,
    amount_krw: Math.round(amount_krw),
    amount_usd: Number(amount_usd.toFixed(2)),
    exchange_rate: rate,
    currency: parsed.currency,
    description: parsed.description,
    category_id: parsed.category_id,
    payment_method_id: null,
    note: null,
    date: new Date().toISOString().split('T')[0],
  })

  if (error) {
    console.error('[telegram] insert transaction error:', error)
    return '❌ Failed to save that. Please try again.'
  }

  const sign = parsed.type === 'income' ? '+' : '−'
  let catName = ''
  if (parsed.category_id) {
    const cat = (categories ?? []).find((c) => c.id === parsed.category_id)
    if (cat) catName = ` · ${cat.name}`
  }
  return `${parsed.type === 'income' ? '💰' : '✅'} Logged: <b>${escapeHtml(parsed.description)}</b>\n${sign}${fmtKRW(amount_krw)}${escapeHtml(catName)}`
}

// ── Webhook handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Verify Telegram's secret token (set during webhook registration).
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret) {
    const got = request.headers.get('x-telegram-bot-api-secret-token')
    if (got !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createTelegramServiceClient()
  if (!supabase) {
    console.error('[telegram] service client not configured')
    return NextResponse.json({ ok: true }) // ack so Telegram doesn't retry forever
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = update.message
  const text = message?.text?.trim()
  const chatId = message?.chat?.id
  if (!chatId || !text) return NextResponse.json({ ok: true })

  // Per-chat rate limit to contain abuse/loops.
  const { allowed } = rateLimit(`tg:${chatId}`, 20, 60_000)
  if (!allowed) {
    await sendTelegramMessage(chatId, '⏳ Slow down a moment — too many messages.')
    return NextResponse.json({ ok: true })
  }

  try {
    let reply: string

    if (text.startsWith('/')) {
      const [cmdRaw, ...rest] = text.split(/\s+/)
      const cmd = cmdRaw.split('@')[0].toLowerCase() // strip @BotName in groups
      const arg = rest.join(' ')

      if (cmd === '/start') {
        reply = arg
          ? await handleLink(supabase, chatId, arg)
          : `👋 Welcome to <b>Money Flow</b>!\n\nTo connect your account, open the app → Settings → Connect Telegram, then send me <code>/link YOUR_CODE</code>.\n\n${HELP_TEXT}`
      } else if (cmd === '/help') {
        reply = HELP_TEXT
      } else if (cmd === '/link') {
        reply = await handleLink(supabase, chatId, arg)
      } else if (cmd === '/unlink') {
        await supabase.from('telegram_accounts').update({ chat_id: null }).eq('chat_id', chatId)
        reply = '👋 This chat has been disconnected. Send /link with a fresh code to reconnect.'
      } else {
        // Commands below require a linked account.
        const userId = await getUserIdForChat(supabase, chatId)
        if (!userId) {
          reply = '🔒 This chat isn\'t linked yet. Open Money Flow → Settings → Connect Telegram and send me <code>/link YOUR_CODE</code>.'
        } else if (cmd === '/balance') {
          reply = await handleBalance(supabase, userId)
        } else if (cmd === '/today') {
          reply = await handleToday(supabase, userId)
        } else if (cmd === '/budget') {
          reply = await handleBudget(supabase, userId)
        } else {
          reply = `Unknown command. ${HELP_TEXT}`
        }
      }
    } else {
      // Free text → log an expense.
      const userId = await getUserIdForChat(supabase, chatId)
      reply = userId
        ? await handleLogExpense(supabase, userId, text)
        : '🔒 This chat isn\'t linked yet. Open Money Flow → Settings → Connect Telegram and send me <code>/link YOUR_CODE</code>.'
    }

    await sendTelegramMessage(chatId, reply)
  } catch (err) {
    console.error('[telegram] handler error:', err)
    await sendTelegramMessage(chatId, '❌ Something went wrong. Please try again.')
  }

  return NextResponse.json({ ok: true })
}
