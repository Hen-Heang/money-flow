import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { format } from 'date-fns'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name), payment_methods(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) throw error

    const transactions = data || []

    // Build CSV
    const headers = ['Date', 'Type', 'Description', 'Amount (KRW)', 'Amount (USD)', 'Exchange Rate', 'Category', 'Payment Method', 'Note']
    const rows = transactions.map(t => {
      const cat = (t.categories as { name: string } | null)?.name || ''
      const pm = (t.payment_methods as { name: string } | null)?.name || ''
      return [
        t.date,
        t.type,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount_krw,
        t.amount_usd.toFixed(2),
        t.exchange_rate,
        `"${cat}"`,
        `"${pm}"`,
        `"${(t.note || '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const filename = `money-flow-${format(new Date(), 'yyyy-MM-dd')}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
