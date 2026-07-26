# Money Flow

A personal finance tracker built with Next.js 16, featuring AI-powered insights, real-time analytics, push notifications, and automatic Neon database backups.

**Live:** [money-flow.henheang.site](https://money-flow.henheang.site)

## Features

- **Transactions** — Income/expense tracking with categories, payment methods, and tags
- **Analytics** — Charts and summaries by period, category, and payment method
- **Budgets** — Monthly budget limits with overspend alerts via push notification
- **Savings Goals** — Track progress toward financial goals with automatic monthly updates
- **Recurring Transactions** — Auto-create transactions on a schedule
- **AI Money Coach** — Deterministic financial analysis surfaced as up to three reviewable insights
- **Subscriptions** — Automatic detection of recurring payments with Keep / Review / Cancel tracking
- **Monthly Review** — Month-end summary with an adaptive, confirmable budget plan for next month
- **AI Chat** — Ask questions about your finances using Google Gemini
- **Push Notifications** — Budget alerts and monthly reports via Web Push
- **PWA** — Installable, works offline, service worker caching
- **Multi-currency** — Exchange rate fetching with weekly cleanup
- **Neon Backup** — Daily sync of all data to Neon Postgres

## Tech Stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Database (primary) | Supabase (Postgres + Auth + RLS) |
| Database (backup) | Neon (serverless Postgres) |
| AI | Google Gemini via Vercel AI SDK |
| Email | Resend |
| Push | Web Push (VAPID) |
| Charts | Recharts |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| Deployment | Vercel |

## Environment Variables

Create `.env.local` at the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Neon backup database
NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/neondb?sslmode=require

# Exchange rates (https://www.exchangerate-api.com)
EXCHANGE_RATE_API_KEY=<key>

# Google Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=<key>

# OpenAI (optional alternative/fallback AI provider)
OPENAI_API_KEY=<key>

# Optional AI model overrides
OPENAI_CHAT_MODEL=gpt-5.6-terra
OPENAI_FAST_MODEL=gpt-5.6-luna

# Cron job protection
CRON_SECRET=<random-secret>

# Web Push (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:you@example.com
```

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test              # Vitest unit tests (finance engine, insights, weekly check-in)
npm run test:watch    # Vitest in watch mode
npm run test:e2e      # Playwright end-to-end tests
```

Playwright runs two projects: `desktop-chromium` and `mobile-428` (iPhone 12 Pro Max,
428 × 926). Tests that need a signed-in session skip unless `E2E_EMAIL` and
`E2E_PASSWORD` are set:

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=... npm run test:e2e
```

First run only: `npx playwright install chromium webkit`.

## AI Money Coach architecture

The language model never performs financial calculations. All arithmetic happens in
the deterministic engine under `lib/finance/analysis/`, using `decimal.js` so summing
many transactions can't drift.

```
transactions + budgets
  → deterministic analysis engine   (lib/finance/analysis/)
  → privacy-safe snapshot           (toAISafePayload — no ids, no email, no raw rows)
  → AI phrasing                     (rewrites title/summary only)
  → structured-output validation    (rejects any number the engine didn't produce)
  → stored insight                  (ai_financial_insights)
  → user review                     (Review / Apply / Snooze / Dismiss)
  → confirmed action                (explicit dialog before any write)
```

AI recommendations never silently change transactions, budgets, or goals. Applying a
budget change opens a confirmation dialog showing the old value, the proposed value,
and the monthly impact.

## Neon Backup Schema

Run `scripts/neon-schema.sql` once in the Neon SQL editor to create the backup tables before the first cron run.

## Cron Jobs

All crons run on Vercel and require `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/recurring` | Daily 00:00 UTC | Create recurring transactions |
| `/api/cron/budget-alerts` | Daily 08:00 UTC | Send budget overspend notifications |
| `/api/cron/monthly-report` | 1st of month 09:00 UTC | Email monthly spending report |
| `/api/cron/savings` | 1st of month 09:30 UTC | Update savings goal progress |
| `/api/cron/cleanup-exchange-rates` | Sunday 03:00 UTC | Delete exchange rates older than 30 days |
| `/api/cron/backup` | Daily 01:00 UTC | Sync all Supabase tables to Neon |
| `/api/cron/weekly-summary` | Monday 00:00 UTC | Weekly AI check-in (respects quiet hours) |

To test a cron locally:

```bash
curl http://localhost:3000/api/cron/backup \
  -H "Authorization: Bearer test-secret-123"
```

## Deployment

Push to `main` — Vercel deploys automatically. Add all environment variables in the Vercel dashboard under **Settings → Environment Variables**.
