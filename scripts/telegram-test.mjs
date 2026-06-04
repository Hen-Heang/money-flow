// Standalone Telegram push test — no DB, no webhook.
// Usage:
//   1. Put your NEW bot token in .env.local (TELEGRAM_BOT_TOKEN=...)
//   2. Open Telegram and send any message (e.g. "hi") to your bot
//   3. node scripts/telegram-test.mjs
//
// It finds your chat via getUpdates and sends a test message back.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].trim()
    }
  } catch {}
  return env
}

const env = loadEnv()
const token = env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is empty in .env.local. Paste your new BotFather token first.')
  process.exit(1)
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`

// 1. Confirm the token works and print the bot identity.
const meRes = await fetch(api('getMe'))
const me = await meRes.json()
if (!me.ok) {
  console.error('❌ getMe failed — is the token correct/revoked?', me)
  process.exit(1)
}
console.log(`🤖 Bot OK: @${me.result.username} (${me.result.first_name})`)

// 2. Find the most recent chat that messaged the bot.
const updRes = await fetch(api('getUpdates'))
const upd = await updRes.json()
const chats = new Map()
for (const u of upd.result ?? []) {
  const chat = u.message?.chat
  if (chat) chats.set(chat.id, chat)
}

if (chats.size === 0) {
  console.error('\n⚠️  No chats found. Open Telegram, send "hi" to @' + me.result.username + ', then re-run this script.')
  console.error('   (Telegram only keeps recent updates, so message the bot just before running.)')
  process.exit(1)
}

console.log(`\n📨 Found ${chats.size} chat(s):`)
for (const c of chats.values()) {
  const who = c.username ? '@' + c.username : [c.first_name, c.last_name].filter(Boolean).join(' ')
  console.log(`   chat_id=${c.id}  ${who || ''}`)
}

// 3. Send a test message to every chat found.
const text =
  '✅ <b>Money Flow bot is connected!</b>\n\nThis is a test push. ' +
  'Budget alerts, recurring transactions, and savings deposits will arrive here.'

for (const id of chats.keys()) {
  const sendRes = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: id, text, parse_mode: 'HTML' }),
  })
  const sent = await sendRes.json()
  console.log(sent.ok ? `\n🚀 Sent to ${id}` : `\n❌ Failed for ${id}: ${JSON.stringify(sent)}`)
}
