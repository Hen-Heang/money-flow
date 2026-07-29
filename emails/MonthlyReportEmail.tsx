import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { MonthlyReport } from '@/lib/finance/monthly-report'

function krw(value: number): string {
  return `₩${Math.round(value).toLocaleString('en-US')}`
}

function usd(value: number): string {
  return `$${value.toLocaleString('en-US')}`
}

const colors = {
  bg: '#f4f4f5',
  card: '#ffffff',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  positive: '#16a34a',
  warning: '#d97706',
  action: '#2563eb',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ margin: '4px 0', fontSize: 14, color: colors.text }}>
      <span style={{ color: colors.muted }}>{label}: </span>
      <strong>{value}</strong>
    </Text>
  )
}

export interface MonthlyReportEmailProps {
  report: MonthlyReport
  reviewUrl: string
}

export default function MonthlyReportEmail({ report, reviewUrl }: MonthlyReportEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${report.monthLabel}: ${krw(report.netSavingsKrw)} net, ${report.savingsRatePct}% savings rate`}</Preview>
      <Body style={{ backgroundColor: colors.bg, fontFamily: 'Helvetica, Arial, sans-serif', padding: '24px 0' }}>
        <Container style={{ backgroundColor: colors.card, borderRadius: 16, padding: 32, maxWidth: 560 }}>
          <Heading style={{ fontSize: 22, margin: '0 0 4px', color: colors.text }}>{report.monthLabel} report</Heading>
          <Text style={{ margin: '0 0 24px', fontSize: 13, color: colors.muted }}>
            {report.periodStart} to {report.periodEnd}
          </Text>

          <Section>
            <Row label="Income" value={krw(report.incomeKrw)} />
            <Row label="Expenses" value={krw(report.expenseKrw)} />
            <Row label="Net savings" value={krw(report.netSavingsKrw)} />
            <Row label="Savings rate" value={`${report.savingsRatePct}%`} />
          </Section>

          <Hr style={{ borderColor: colors.border, margin: '20px 0' }} />

          <Heading as="h2" style={{ fontSize: 15, margin: '0 0 8px', color: colors.text }}>
            Compared to {report.previousMonth.month}
          </Heading>
          <Row
            label="Expenses"
            value={
              report.previousMonth.expenseDeltaPct === null
                ? 'No prior data'
                : `${report.previousMonth.expenseDeltaPct > 0 ? '+' : ''}${report.previousMonth.expenseDeltaPct}%`
            }
          />
          <Row
            label="Savings rate"
            value={
              report.previousMonth.savingsRateDeltaPct === null
                ? 'No prior data'
                : `${report.previousMonth.savingsRateDeltaPct > 0 ? '+' : ''}${report.previousMonth.savingsRateDeltaPct}pp`
            }
          />

          {report.topCategories.length > 0 && (
            <>
              <Hr style={{ borderColor: colors.border, margin: '20px 0' }} />
              <Heading as="h2" style={{ fontSize: 15, margin: '0 0 8px', color: colors.text }}>
                Top categories
              </Heading>
              {report.topCategories.map((c) => (
                <Row key={c.categoryId ?? c.name} label={c.name} value={`${krw(c.totalKrw)} (${c.pctOfTotal}%)`} />
              ))}
            </>
          )}

          {report.budgetStatus.filter((b) => b.budgetKrw > 0).length > 0 && (
            <>
              <Hr style={{ borderColor: colors.border, margin: '20px 0' }} />
              <Heading as="h2" style={{ fontSize: 15, margin: '0 0 8px', color: colors.text }}>
                Budget status
              </Heading>
              {report.budgetStatus
                .filter((b) => b.budgetKrw > 0)
                .map((b) => (
                  <Row
                    key={b.category_id}
                    label={b.category_name}
                    value={`${krw(b.spentKrw)} / ${krw(b.budgetKrw)} (${Math.round(b.usagePct)}%)${b.overBudget ? ' — over' : ''}`}
                  />
                ))}
            </>
          )}

          {report.savingsGoals.length > 0 && (
            <>
              <Hr style={{ borderColor: colors.border, margin: '20px 0' }} />
              <Heading as="h2" style={{ fontSize: 15, margin: '0 0 8px', color: colors.text }}>
                Savings goals
              </Heading>
              {report.savingsGoals.map((g) => (
                <Row key={g.goalId} label={g.name} value={`${usd(g.currentUsd)} / ${usd(g.targetUsd)} (${g.status.replace('_', ' ')})`} />
              ))}
            </>
          )}

          {report.recurringExpenses.items.length > 0 && (
            <>
              <Hr style={{ borderColor: colors.border, margin: '20px 0' }} />
              <Heading as="h2" style={{ fontSize: 15, margin: '0 0 8px', color: colors.text }}>
                Recurring expenses — {krw(report.recurringExpenses.totalMonthlyKrw)}/month
              </Heading>
              {report.recurringExpenses.items.slice(0, 8).map((r) => (
                <Row key={r.name} label={r.name} value={`${krw(r.monthlyKrw)}/mo`} />
              ))}
            </>
          )}

          <Hr style={{ borderColor: colors.border, margin: '20px 0' }} />

          <Text style={{ fontSize: 14, color: colors.positive, margin: '6px 0' }}>✅ {report.insights.positive.message}</Text>
          <Text style={{ fontSize: 14, color: colors.warning, margin: '6px 0' }}>⚠️ {report.insights.warning.message}</Text>
          <Text style={{ fontSize: 14, color: colors.action, margin: '6px 0' }}>💡 {report.insights.action.message}</Text>

          <Section style={{ marginTop: 24, textAlign: 'center' }}>
            <Link
              href={reviewUrl}
              style={{
                backgroundColor: colors.text,
                color: colors.card,
                padding: '12px 24px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              View full monthly review
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
