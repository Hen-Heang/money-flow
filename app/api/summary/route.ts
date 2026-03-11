import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let query = supabase
      .from('transactions')
      .select('type, amount_krw, amount_usd, category_id, date, categories(name, icon, color)')
      .eq('user_id', user.id)

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
    if (error) throw error

    const transactions = data || []

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
    const totalIncomeUSD = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_usd, 0)
    const totalExpenseUSD = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_usd, 0)

    // Category breakdown
    const categoryMap: Record<string, { name: string; total_krw: number; total_usd: number; count: number }> = {}
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const catRaw = t.categories
        const cat = catRaw && !Array.isArray(catRaw) ? catRaw as { name: string } : null
        const key = cat?.name || 'Uncategorized'
        if (!categoryMap[key]) categoryMap[key] = { name: key, total_krw: 0, total_usd: 0, count: 0 }
        categoryMap[key].total_krw += t.amount_krw
        categoryMap[key].total_usd += t.amount_usd
        categoryMap[key].count++
      })

    const byCategory = Object.values(categoryMap).sort((a, b) => b.total_krw - a.total_krw)

    // Monthly breakdown
    const monthlyMap: Record<string, { income: number; expense: number }> = {}
    transactions.forEach(t => {
      const month = t.date.substring(0, 7)
      if (!monthlyMap[month]) monthlyMap[month] = { income: 0, expense: 0 }
      if (t.type === 'income') monthlyMap[month].income += t.amount_krw
      else monthlyMap[month].expense += t.amount_krw
    })

    const byMonth = Object.entries(monthlyMap)
      .map(([month, vals]) => ({ month, ...vals }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      totalIncomeUSD,
      totalExpenseUSD,
      balanceUSD: totalIncomeUSD - totalExpenseUSD,
      byCategory,
      byMonth,
      transactionCount: transactions.length,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
