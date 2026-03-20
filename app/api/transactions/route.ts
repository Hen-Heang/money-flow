import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const VALID_TYPES = ['income', 'expense'] as const
const VALID_CURRENCIES = ['KRW', 'USD'] as const
const MAX_DESCRIPTION_LENGTH = 200
const MAX_NOTE_LENGTH = 500
const MAX_PAGE_SIZE = 100

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function validateTransactionBody(body: Record<string, unknown>, isPartial = false) {
  const errors: string[] = []

  // type
  if (!isPartial || body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
      errors.push('type must be "income" or "expense"')
    }
  }

  // amount_krw
  if (!isPartial || body.amount_krw !== undefined) {
    const krw = Number(body.amount_krw)
    if (!Number.isFinite(krw) || krw <= 0) {
      errors.push('amount_krw must be a positive number')
    }
  }

  // amount_usd
  if (!isPartial || body.amount_usd !== undefined) {
    const usd = Number(body.amount_usd)
    if (!Number.isFinite(usd) || usd <= 0) {
      errors.push('amount_usd must be a positive number')
    }
  }

  // description
  if (!isPartial || body.description !== undefined) {
    const desc = String(body.description ?? '').trim()
    if (!desc) errors.push('description is required')
    else if (desc.length > MAX_DESCRIPTION_LENGTH) errors.push(`description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`)
  }

  // date
  if (!isPartial || body.date !== undefined) {
    const d = body.date
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(d) || isNaN(Date.parse(d))) {
      errors.push('date must be a valid ISO date string')
    }
  }

  // currency (optional field)
  if (body.currency !== undefined && !VALID_CURRENCIES.includes(body.currency as typeof VALID_CURRENCIES[number])) {
    errors.push('currency must be "KRW" or "USD"')
  }

  // note (optional)
  if (body.note !== undefined && typeof body.note === 'string' && body.note.length > MAX_NOTE_LENGTH) {
    errors.push(`note must be ${MAX_NOTE_LENGTH} characters or fewer`)
  }

  return errors
}

function sanitizeBody(body: Record<string, unknown>) {
  // Only allow known fields — never let client set user_id or internal fields
  const allowed = ['type', 'amount_krw', 'amount_usd', 'exchange_rate', 'currency', 'date', 'description', 'category_id', 'payment_method_id', 'note'] as const
  const clean: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) clean[key] = body[key]
  }
  if (typeof clean.description === 'string') clean.description = clean.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
  if (typeof clean.note === 'string') clean.note = clean.note.trim().slice(0, MAX_NOTE_LENGTH)
  return clean
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const type = searchParams.get('type')
    const page = Math.max(0, parseInt(searchParams.get('page') || '0'))
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))

    let query = supabase
      .from('transactions')
      .select('*, categories(name, icon, color), payment_methods(name, icon)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (from && /^\d{4}-\d{2}-\d{2}/.test(from)) query = query.gte('date', from)
    if (to && /^\d{4}-\d{2}-\d{2}/.test(to)) query = query.lte('date', to)
    if (type === 'income' || type === 'expense') query = query.eq('type', type)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ data, count, page, pageSize })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const errors = validateTransactionBody(body, false)
    if (errors.length) return bad(errors.join('; '))

    const clean = sanitizeBody(body)
    const { data, error } = await supabase
      .from('transactions')
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
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return bad('ID required')

    const body = await request.json()
    const errors = validateTransactionBody(body, true)
    if (errors.length) return bad(errors.join('; '))

    const clean = sanitizeBody(body)
    const { data, error } = await supabase
      .from('transactions')
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
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return bad('ID required')

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
