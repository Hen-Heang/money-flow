import { NextRequest, NextResponse } from 'next/server'

// One-time (idempotent) webhook registration with Telegram.
// Protected with CRON_SECRET so randoms can't re-point your bot.
//
// Call it once after deploying:
//   GET /api/telegram/setup?url=https://your-app.com   (Authorization: Bearer <CRON_SECRET>)
// If ?url is omitted, the request origin is used.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' }, { status: 500 })

  const { searchParams, origin } = new URL(request.url)
  const base = (searchParams.get('url') || origin).replace(/\/$/, '')
  const webhookUrl = `${base}/api/telegram`

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  })

  const result = await res.json()
  return NextResponse.json({ webhookUrl, telegram: result }, { status: res.ok ? 200 : 502 })
}
