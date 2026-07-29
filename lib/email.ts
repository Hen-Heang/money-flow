import 'server-only'
import { Resend } from 'resend'
import MonthlyReportEmail from '@/emails/MonthlyReportEmail'
import type { MonthlyReport } from '@/lib/finance/monthly-report'

// Server-only by construction: `import 'server-only'` makes this module
// fail to build if anything tries to import it from a client component, so
// RESEND_API_KEY can never end up in a client bundle.

export interface EmailSendResult {
  ok: boolean
  id?: string
  error?: string
}

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const DEFAULT_FROM = 'Money Flow <reports@updates.moneyflow.app>'

export async function sendMonthlyReportEmail(to: string, report: MonthlyReport, reviewUrl: string): Promise<EmailSendResult> {
  const resend = client()
  if (!resend) {
    console.error('[email] RESEND_API_KEY not configured')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to,
      subject: `Your ${report.monthLabel} financial report`,
      react: MonthlyReportEmail({ report, reviewUrl }),
    })

    if (error) {
      console.error('[email] Resend send failed:', error.message)
      return { ok: false, error: error.message }
    }

    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[email] send error:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown email error' }
  }
}
