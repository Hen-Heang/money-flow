import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const exportFormat = req.nextUrl.searchParams.get('format') ?? 'csv'

    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name, icon), payment_methods(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) throw error
    const transactions = data || []
    const dateStr = format(new Date(), 'yyyy-MM-dd')

    // ── JSON ──────────────────────────────────────────────────────────────────
    if (exportFormat === 'json') {
      const clean = transactions.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        amount_krw: t.amount_krw,
        amount_usd: Number(t.amount_usd.toFixed(2)),
        exchange_rate: t.exchange_rate,
        currency: t.currency,
        category: (t.categories as { name: string; icon: string } | null)?.name ?? null,
        payment_method: (t.payment_methods as { name: string } | null)?.name ?? null,
        note: t.note ?? null,
      }))
      return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), count: clean.length, transactions: clean }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="money-flow-${dateStr}.json"`,
        },
      })
    }

    // ── CSV (default) ─────────────────────────────────────────────────────────
    const headers = ['Date', 'Type', 'Description', 'Amount (KRW)', 'Amount (USD)', 'Exchange Rate', 'Currency', 'Category', 'Payment Method', 'Note']
    const rows = transactions.map(t => {
      const cat = (t.categories as { name: string } | null)?.name ?? ''
      const pm  = (t.payment_methods as { name: string } | null)?.name ?? ''
      return [
        t.date,
        t.type,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount_krw,
        t.amount_usd.toFixed(2),
        t.exchange_rate ?? '',
        t.currency ?? 'KRW',
        `"${cat}"`,
        `"${pm}"`,
        `"${(t.note ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="money-flow-${dateStr}.csv"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
