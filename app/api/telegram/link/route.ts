import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

// Authenticated endpoints for the in-app "Connect Telegram" flow.
//  GET    → current link status
//  POST   → generate a fresh one-time link code (+ deep link)
//  DELETE → disconnect Telegram

const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''

// Unambiguous alphabet (no 0/O/1/I) for easy typing.
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('telegram_accounts')
    .select('chat_id, linked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    linked: Boolean(data?.chat_id),
    linkedAt: data?.linked_at ?? null,
  })
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = rateLimit(`tg-link:${user.id}`, 10, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  // Upsert only the code fields — preserves an existing chat_id/linked_at.
  const { error } = await supabase
    .from('telegram_accounts')
    .upsert(
      { user_id: user.id, link_code: code, link_code_expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('[telegram/link] upsert error:', error)
    return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
  }

  const deepLink = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=${code}` : null

  return NextResponse.json({ code, expiresAt, botUsername: BOT_USERNAME || null, deepLink })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('telegram_accounts')
    .update({ chat_id: null, link_code: null, link_code_expires_at: null, linked_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) {
    console.error('[telegram/link] unlink error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
