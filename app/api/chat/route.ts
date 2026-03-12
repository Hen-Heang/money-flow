import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DEFAULT_GEMINI_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.5-flash'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()

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
