import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Runs on the 1st of each month via Vercel Cron.
// Sends every user a monthly summary email via Resend.

function formatKRW(amount: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)
}

function buildEmailHtml({
  displayName,
  month,
  totalIncome,
  totalExpense,
  balance,
  savingsRate,
  topCategories,
}: {
  displayName: string
  month: string
  totalIncome: number
  totalExpense: number
  balance: number
  savingsRate: number
  topCategories: { name: string; total: number }[]
}) {
  const balanceColor = balance >= 0 ? '#10b981' : '#ef4444'
  const categoryRows = topCategories
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 0;color:#94a3b8;font-size:14px;">${c.name}</td>
        <td style="padding:8px 0;color:#f8fafc;font-size:14px;text-align:right;">${formatKRW(c.total)}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;padding:12px 24px;background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:24px;font-weight:900;color:#f8fafc;letter-spacing:-0.5px;">Money Flow</span>
      </div>
      <p style="color:#94a3b8;font-size:14px;margin-top:16px;">Your ${month} Financial Summary</p>
    </div>

    <!-- Greeting -->
    <p style="color:#f8fafc;font-size:16px;margin-bottom:24px;">Hey ${displayName} 👋</p>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:32px;">
      Here's your money snapshot for <strong style="color:#f8fafc;">${month}</strong>. Keep it up!
    </p>

    <!-- Stats cards -->
    <div style="display:grid;gap:12px;margin-bottom:24px;">
      <div style="background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Income</span>
        <span style="color:#10b981;font-size:20px;font-weight:800;">${formatKRW(totalIncome)}</span>
      </div>
      <div style="background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Expenses</span>
        <span style="color:#ef4444;font-size:20px;font-weight:800;">${formatKRW(totalExpense)}</span>
      </div>
      <div style="background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Net Balance</span>
        <span style="color:${balanceColor};font-size:20px;font-weight:800;">${formatKRW(balance)}</span>
      </div>
      <div style="background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Savings Rate</span>
        <span style="color:#3b82f6;font-size:20px;font-weight:800;">${savingsRate.toFixed(1)}%</span>
      </div>
    </div>

    <!-- Top spending categories -->
    ${
      topCategories.length > 0
        ? `<div style="background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:20px 24px;margin-bottom:24px;">
      <p style="color:#f8fafc;font-size:14px;font-weight:700;margin:0 0 16px;">Top Spending Categories</p>
      <table style="width:100%;border-collapse:collapse;">${categoryRows}</table>
    </div>`
        : ''
    }

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://money-flow.app" style="display:inline-block;padding:14px 32px;background:#3b82f6;color:#fff;font-size:15px;font-weight:700;border-radius:100px;text-decoration:none;">
        Open Money Flow
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#475569;font-size:12px;text-align:center;line-height:1.6;">
      You're receiving this because you use Money Flow.<br>
      This report is generated automatically on the 1st of each month.
    </p>
  </div>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Money Flow <reports@money-flow.app>'
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get last month's date range
  const now = new Date()
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const fromDate = firstOfLastMonth.toISOString().split('T')[0]
  const toDate = lastOfLastMonth.toISOString().split('T')[0]
  const monthLabel = firstOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Fetch all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('[cron/monthly-report] listUsers error:', usersError)
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  const eligibleUsers = (users.users as { id: string; email?: string }[]).filter(u => u.email)
  const userIds = eligibleUsers.map(u => u.id)

  let sent = 0
  let skipped = 0

  if (userIds.length === 0) {
    return NextResponse.json({ sent, skipped, month: monthLabel })
  }

  // Batch all DB queries — 2 queries for all users instead of 2×N
  const [{ data: allTxns }, { data: allProfiles }] = await Promise.all([
    supabase
      .from('transactions')
      .select('user_id, type, amount_krw, categories(name)')
      .in('user_id', userIds)
      .gte('date', fromDate)
      .lte('date', toDate),
    supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds),
  ])

  // Group transactions by userId
  const txnsByUser: Record<string, typeof allTxns> = {}
  ;(allTxns || []).forEach(t => {
    const uid = (t as typeof t & { user_id: string }).user_id
    if (!txnsByUser[uid]) txnsByUser[uid] = []
    txnsByUser[uid]!.push(t)
  })

  // Map profiles by userId
  const profileByUser: Record<string, string> = {}
  ;(allProfiles || []).forEach((p: { id: string; display_name: string | null }) => {
    if (p.display_name) profileByUser[p.id] = p.display_name
  })

  // Send emails concurrently (max 5 at a time to avoid rate limits)
  const CONCURRENCY = 5
  for (let i = 0; i < eligibleUsers.length; i += CONCURRENCY) {
    const batch = eligibleUsers.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async user => {
      const txns = txnsByUser[user.id]
      if (!txns || txns.length === 0) { skipped++; return }

      const totalIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
      const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
      const balance = totalIncome - totalExpense
      const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0

      const catMap: Record<string, number> = {}
      txns.filter(t => t.type === 'expense').forEach(t => {
        const catRaw = t.categories
        const cat = catRaw && !Array.isArray(catRaw) ? (catRaw as { name: string }) : null
        const key = cat?.name || 'Uncategorized'
        catMap[key] = (catMap[key] || 0) + t.amount_krw
      })
      const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total }))

      const displayName = profileByUser[user.id] || user.email!.split('@')[0]
      const html = buildEmailHtml({ displayName, month: monthLabel, totalIncome, totalExpense, balance, savingsRate, topCategories })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: user.email, subject: `Your ${monthLabel} Money Flow Report`, html }),
      })

      if (res.ok) { sent++ }
      else {
        console.error(`[cron/monthly-report] Failed to send to ${user.email}:`, await res.text())
        skipped++
      }
    }))
  }

  return NextResponse.json({ sent, skipped, month: monthLabel })
}
