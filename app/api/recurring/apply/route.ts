import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function advanceDate(dateStr: string, frequency: string): string {
  const date = new Date(dateStr)
  switch (frequency) {
    case 'daily':   date.setDate(date.getDate() + 1); break
    case 'weekly':  date.setDate(date.getDate() + 7); break
    case 'monthly': date.setMonth(date.getMonth() + 1); break
    case 'yearly':  date.setFullYear(date.getFullYear() + 1); break
  }
  return date.toISOString().split('T')[0]
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]

    // Find all active recurring rules that are due today or overdue
    const { data: due, error: fetchError } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_date', today)

    if (fetchError) throw fetchError
    if (!due || due.length === 0) return NextResponse.json({ applied: 0 })

    const applied: string[] = []

    for (const rule of due) {
      // Create the real transaction using the rule's next_date as the transaction date
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: rule.type,
          amount_krw: rule.amount_krw,
          amount_usd: rule.amount_usd,
          exchange_rate: rule.exchange_rate,
          currency: rule.currency,
          description: rule.description,
          category_id: rule.category_id,
          payment_method_id: rule.payment_method_id,
          note: rule.note,
          date: rule.next_date,
        })

      if (insertError) {
        console.error(`[recurring/apply] Failed to insert for rule ${rule.id}:`, insertError)
        continue
      }

      // Advance next_date to the next occurrence
      const nextDate = advanceDate(rule.next_date, rule.frequency)

      await supabase
        .from('recurring_transactions')
        .update({ next_date: nextDate, last_applied: rule.next_date })
        .eq('id', rule.id)
        .eq('user_id', user.id)

      applied.push(rule.description)
    }

    return NextResponse.json({ applied: applied.length, descriptions: applied })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
