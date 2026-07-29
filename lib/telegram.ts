import { createClient } from '@supabase/supabase-js'

// ── Bot API helpers ──────────────────────────────────────────────────────────

const TELEGRAM_API = 'https://api.telegram.org'

function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}

export interface TelegramSendResult {
  ok: boolean
  messageId?: string
  error?: string
}

async function postTelegramMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<TelegramSendResult> {
  const token = botToken()
  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN not configured')
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
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
      const body = await res.text()
      console.error('[telegram] sendMessage failed:', res.status, body)
      return { ok: false, error: `Telegram API responded ${res.status}` }
    }
    const json = (await res.json()) as { result?: { message_id?: number } }
    return { ok: true, messageId: json.result?.message_id !== undefined ? String(json.result.message_id) : undefined }
  } catch (err) {
    console.error('[telegram] sendMessage error:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown Telegram error' }
  }
}

/** Send a message to a Telegram chat. Returns whether Telegram accepted it. */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const result = await postTelegramMessage(chatId, text, extra)
  return result.ok
}

/** Same as sendTelegramMessage but returns the provider message id / error for auditing. */
export async function sendTelegramMessageDetailed(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<TelegramSendResult> {
  return postTelegramMessage(chatId, text, extra)
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

/** Same as sendTelegramToUser but returns the provider message id / error for auditing. */
export async function sendTelegramToUserDetailed(
  supabase: ServiceClient,
  userId: string,
  text: string,
): Promise<TelegramSendResult> {
  const { data } = await supabase
    .from('telegram_accounts')
    .select('chat_id')
    .eq('user_id', userId)
    .maybeSingle()
  const chatId = data?.chat_id
  if (!chatId) return { ok: false, error: 'No linked Telegram chat' }
  return sendTelegramMessageDetailed(chatId, text)
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function fmtKRW(amount: number): string {
  return '₩' + Math.round(amount).toLocaleString('en-US')
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
