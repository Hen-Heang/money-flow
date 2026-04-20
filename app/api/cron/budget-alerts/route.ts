import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime = 'nodejs'

// Runs daily at 8 AM via Vercel Cron.
// Checks all users' current-month spending vs budgets and sends a push
// notification if any category is at or above 80% of its budget.

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

interface BudgetRow {
  category_id: string
  amount_krw: number
}

interface TransactionRow {
  type: string
  amount_krw: number
  category_id: string | null
}

async function sendPush(sub: PushSubscriptionRow, payload: object) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
  } catch (err: unknown) {
    // 410 = subscription expired/unregistered — caller should clean it up
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err
    }
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@money-flow.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get all users who have push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ notified: 0, message: 'No push subscriptions' })
  }

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  // Group subscriptions by user
  const userSubs = subscriptions.reduce<Record<string, PushSubscriptionRow[]>>((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = []
    acc[s.user_id].push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    return acc
  }, {})

  const userIds = Object.keys(userSubs)

  // Batch all DB queries across all users — 3 queries total instead of 3×N
  const [{ data: allBudgets }, { data: allTxns }, { data: allCategories }] = await Promise.all([
    supabase.from('budgets').select('user_id, category_id, amount_krw').in('user_id', userIds),
    supabase
      .from('transactions')
      .select('user_id, amount_krw, category_id')
      .in('user_id', userIds)
      .eq('type', 'expense')
      .gte('date', monthStart)
      .lte('date', today),
    supabase.from('categories').select('user_id, id, name, icon').in('user_id', userIds),
  ])

  // Group by userId in memory
  const budgetsByUser: Record<string, BudgetRow[]> = {}
  ;(allBudgets || []).forEach((b: BudgetRow & { user_id: string }) => {
    if (!budgetsByUser[b.user_id]) budgetsByUser[b.user_id] = []
    budgetsByUser[b.user_id].push(b)
  })

  const spendByUser: Record<string, Record<string, number>> = {}
  ;(allTxns as (TransactionRow & { user_id: string })[] || []).forEach(t => {
    if (!t.category_id) return
    if (!spendByUser[t.user_id]) spendByUser[t.user_id] = {}
    spendByUser[t.user_id][t.category_id] = (spendByUser[t.user_id][t.category_id] || 0) + t.amount_krw
  })

  const catsByUser: Record<string, { id: string; name: string; icon: string }[]> = {}
  ;(allCategories || []).forEach((c: { user_id: string; id: string; name: string; icon: string }) => {
    if (!catsByUser[c.user_id]) catsByUser[c.user_id] = []
    catsByUser[c.user_id].push(c)
  })

  let notified = 0

  for (const [userId, subs] of Object.entries(userSubs)) {
    const budgets = budgetsByUser[userId]
    if (!budgets || budgets.length === 0) continue

    const spendMap = spendByUser[userId] || {}
    const categories = catsByUser[userId] || []

    const alerts = budgets
      .filter(b => b.amount_krw > 0 && (spendMap[b.category_id] || 0) >= b.amount_krw * 0.8)
      .map(b => {
        const cat = categories.find(c => c.id === b.category_id)
        const pct = Math.round(((spendMap[b.category_id] || 0) / b.amount_krw) * 100)
        return { name: cat?.name || 'Category', icon: cat?.icon || '📊', pct }
      })

    if (alerts.length === 0) continue

    const title = alerts.length === 1
      ? `${alerts[0].icon} ${alerts[0].name} at ${alerts[0].pct}% of budget`
      : `${alerts.length} budget categories need attention`

    const body = alerts.length === 1
      ? alerts[0].pct >= 100
        ? 'You\'ve exceeded this budget. Consider cutting back.'
        : 'You\'re close to your limit for this month.'
      : alerts.map(a => `${a.icon} ${a.name}: ${a.pct}%`).join(' · ')

    const payload = {
      title,
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'budget-alert',
      data: { url: '/' },
    }

    for (const sub of subs) {
      try {
        await sendPush(sub, payload)
        notified++
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }
  }

  return NextResponse.json({ notified })
}
