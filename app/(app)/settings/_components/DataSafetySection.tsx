'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, FileJson, FileText, LogOut } from 'lucide-react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { haptic } from '@/lib/utils'
import { Group, Row } from './Primitives'

async function triggerDownload(format: 'csv' | 'json') {
  haptic('light')
  try {
    const response = await fetch(`/api/export?format=${format}`)
    if (!response.ok) throw new Error()
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `money-flow-${new Date().toISOString().split('T')[0]}.${format}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${format.toUpperCase()} exported!`)
  } catch {
    toast.error('Export failed')
  }
}

async function handleExportPDF() {
  haptic('light')
  try {
    const response = await fetch('/api/export?format=json')
    if (!response.ok) throw new Error()
    const { transactions } = await response.json() as {
      transactions: Array<{
        date: string; type: string; description: string
        amount_krw: number; amount_usd: number; category: string | null
        payment_method: string | null; note: string | null
      }>
    }

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = transactions.map(t => `
      <tr>
        <td>${t.date}</td>
        <td class="${t.type}">${t.type}</td>
        <td>${t.description}</td>
        <td>${t.category ?? '—'}</td>
        <td class="amount">${t.type === 'income' ? '+' : '-'}₩${Math.round(t.amount_krw).toLocaleString()}</td>
        <td class="amount">$${t.amount_usd.toFixed(2)}</td>
        ${t.note ? `<td><em>${t.note}</em></td>` : '<td>—</td>'}
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Money Flow Export — ${dateStr}</title>
      <style>
        body { font-family: -apple-system, sans-serif; font-size: 11px; color: #111; margin: 32px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.sub { color: #666; margin-bottom: 24px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f4f4f4; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e0e0e0; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
        td.income { color: #10b981; font-weight: 700; }
        td.expense { color: #ef4444; font-weight: 700; }
        td.amount { font-variant-numeric: tabular-nums; text-align: right; }
        tr:nth-child(even) td { background: #fafafa; }
        @media print { body { margin: 16px; } }
      </style>
    </head><body>
      <h1>Money Flow — Transaction History</h1>
      <p class="sub">Exported ${dateStr} · ${transactions.length} transactions</p>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th style="text-align:right">KRW</th><th style="text-align:right">USD</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('Allow popups to export PDF'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  } catch {
    toast.error('Export failed')
  }
}

export function DataSafetySection() {
  const router = useRouter()
  const supabase = useSupabaseClient()

  const handleSignOut = async () => {
    haptic('medium')
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Group title="Data & Safety">
      <Row
        icon={Download}
        color="#8b5cf6"
        title="Export CSV"
        subtitle="Spreadsheet-compatible backup"
        onClick={() => triggerDownload('csv')}
      />
      <Row
        icon={FileJson}
        color="#06b6d4"
        title="Export JSON"
        subtitle="Full data for developers"
        onClick={() => triggerDownload('json')}
      />
      <Row
        icon={FileText}
        color="#f59e0b"
        title="Print / Save PDF"
        subtitle="Opens print dialog"
        onClick={handleExportPDF}
      />
      <Row
        icon={LogOut}
        color="var(--color-expense-base)"
        title="Sign Out"
        subtitle="Securely end session"
        onClick={handleSignOut}
      />
    </Group>
  )
}
