import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'

const VALID_TYPES = ['income', 'expense'] as const
const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const
const VALID_CURRENCIES = ['KRW', 'USD'] as const

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

function validateBody(body: Record<string, unknown>) {
  const errors: string[] = []
  if (!VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) errors.push('type must be "income" or "expense"')
  if (!VALID_FREQUENCIES.includes(body.frequency as typeof VALID_FREQUENCIES[number])) errors.push('frequency must be daily, weekly, monthly, or yearly')
  if (body.currency !== undefined && !VALID_CURRENCIES.includes(body.currency as typeof VALID_CURRENCIES[number])) errors.push('currency must be "KRW" or "USD"')
  const krw = Number(body.amount_krw)
  if (!Number.isFinite(krw) || krw <= 0) errors.push('amount_krw must be a positive number')
  const usd = Number(body.amount_usd)
  if (!Number.isFinite(usd) || usd <= 0) errors.push('amount_usd must be a positive number')
  const desc = String(body.description ?? '').trim()
  if (!desc) errors.push('description is required')
  if (typeof body.next_date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(body.next_date) || isNaN(Date.parse(body.next_date))) {
    errors.push('next_date must be a valid ISO date string')
  }
  return errors
}

function sanitize(body: Record<string, unknown>) {
  const allowed = ['type', 'amount_krw', 'amount_usd', 'exchange_rate', 'currency', 'description', 'category_id', 'payment_method_id', 'note', 'frequency', 'next_date', 'is_active'] as const
  const clean: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) clean[key] = body[key]
  }
  if (typeof clean.description === 'string') clean.description = clean.description.trim().slice(0, 200)
  if (typeof clean.note === 'string') clean.note = clean.note.trim().slice(0, 500)
  return clean
}

export async function GET() {
  try {
    const { user, supabase } = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*, categories(name, icon, color), payment_methods(name, icon)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const errors = validateBody(body)
    if (errors.length) return bad(errors.join('; '))

    const clean = sanitize(body)
    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert({ ...clean, user_id: user.id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, supabase } = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return bad('ID required')

    const body = await request.json()
    const clean = sanitize(body)

    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(clean)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return bad('ID required')

    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
