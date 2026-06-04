import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

// TEMPORARY diagnostic route — proves server-initiated push works before linking.
// Protected by CRON_SECRET. Remove after testing.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const chatId = new URL(request.url).searchParams.get('chat_id')
  if (!chatId) return NextResponse.json({ error: 'chat_id required' }, { status: 400 })

  await sendTelegramMessage(
    chatId,
    '🔔 <b>Test push from Money Flow</b>\n\nThis message was sent by the <i>server</i>, not as a reply — exactly how budget alerts, recurring transactions, and savings deposits will reach you. ✅',
  )
  return NextResponse.json({ ok: true, chatId })
}
