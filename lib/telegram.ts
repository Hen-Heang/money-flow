import { createClient } from '@supabase/supabase-js'

// ── Bot API helpers ──────────────────────────────────────────────────────────

const TELEGRAM_API = 'https://api.telegram.org'

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}

/** Send a message to a Telegram chat. Returns whether Telegram accepted it. */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const token = botToken()
  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN not configured')
    return false
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...extra,
      }),
    })
    if (!res.ok) {
      console.error('[telegram] sendMessage failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] sendMessage error:', err)
    return false
  }
}

// ── Service-role Supabase client ─────────────────────────────────────────────
// The webhook has no user session, so it acts as admin (bypasses RLS).
// Always scope every query by user_id derived from the linked chat.

export function createTelegramServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ServiceClient = NonNullable<ReturnType<typeof createTelegramServiceClient>>

/**
 * Send a message to a user's linked Telegram chat (if any).
 * Returns true if Telegram accepted the message.
 */
export async function sendTelegramToUser(
  supabase: ServiceClient,
  userId: string,
  text: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('telegram_accounts')
    .select('chat_id')
    .eq('user_id', userId)
    .maybeSingle()
  const chatId = data?.chat_id
  if (!chatId) return false
  return sendTelegramMessage(chatId, text)
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function fmtKRW(amount: number): string {
  return '₩' + Math.round(amount).toLocaleString('en-US')
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
