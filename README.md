# Money Flow

A personal finance tracker built with Next.js 16, featuring AI-powered insights, real-time analytics, push notifications, and automatic Neon database backups.

**Live:** [money-flow.henheang.site](https://money-flow.henheang.site)

## Features

- **Transactions** — Income/expense tracking with categories, payment methods, and tags
- **Analytics** — Charts and summaries by period, category, and payment method
- **Budgets** — Monthly budget limits with overspend alerts via push notification
- **Savings Goals** — Track progress toward financial goals with automatic monthly updates
- **Recurring Transactions** — Auto-create transactions on a schedule
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

To test a cron locally:

```bash
curl http://localhost:3000/api/cron/backup \
  -H "Authorization: Bearer test-secret-123"
```

## Deployment

Push to `main` — Vercel deploys automatically. Add all environment variables in the Vercel dashboard under **Settings → Environment Variables**.
