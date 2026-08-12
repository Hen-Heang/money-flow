# Money Flow

**Current app version:** `v1.2.0` (Pro Edition)

**Live:** [money-flow.henheang.site](https://money-flow.henheang.site)

Money Flow is a mobile-first personal finance PWA built with Next.js 16 and
Supabase. It tracks everyday cash flow, budgets, savings, subscriptions, and
recurring transactions, then turns that data into deterministic reports and
reviewable AI-assisted insights.

## Latest code highlights

- Faster repeat navigation with TanStack Query caching for categories,
  analytics, and monthly budget spending, plus month-level dashboard caching.
- A clearer mobile transaction form: every field is visible up front, the
  numeric keypad opens only when requested, safe-area spacing is respected,
  and selects have accessible labels.
- Deferred loading for the AI chat interface so the heavier chat bundle is
  downloaded only when the launcher is opened.
- Route-level loading and error states, with feature code split into focused
  components, hooks, types, and pure derivation helpers.
- A database maintenance migration that removes duplicate indexes without
  changing application data.
- Playwright coverage for the 428 x 926 mobile transaction flow, alongside the
  existing desktop and authenticated finance journeys.

## Features

- **Transactions** - Track income and expenses with categories, payment
  methods, notes, KRW/USD conversion, search, filters, bulk actions, swipe
  actions, reusable templates, and AI-assisted quick entry.
- **Dashboard and analytics** - Monthly summaries, category and payment-method
  breakdowns, trends, projections, recent activity, and budget warnings.
- **Budgets** - Set monthly category limits, classify spending, receive
  Telegram overspend alerts, and review a confirmable plan for the next month.
- **Savings goals** - Track targets, scheduled contributions, reminders, and
  progress celebrations.
- **Recurring transactions** - Automatically create daily, weekly, monthly, or
  yearly income and expense entries.
- **Subscriptions** - Detect likely recurring payments and mark them as Keep,
  Review, or Cancel.
- **AI Money Coach** - Surface up to three deterministic, reviewable insights;
  financial calculations remain outside the language model.
- **AI chat** - Ask questions about your own finance data with Google Gemini or
  OpenAI, select a preferred provider, and use the other as a configured
  fallback.
- **Reports and alerts** - Receive weekly summaries, spending-spike alerts,
  daily reminders, and detailed monthly reports through Telegram and optional
  email delivery.
- **Telegram expense logging** - Link a Telegram account and record expenses
  through the bot.
- **Data export** - Download CSV or JSON data, or open a printable PDF view.
- **PWA** - Install the app and use its cached application shell when offline.
- **Themes and currency** - Light/dark appearance settings and consistent
  multi-currency formatting across the app.

## Tech stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16.1, React 19.2, TypeScript 5 |
| Styling | Tailwind CSS 4, Framer Motion, Geist |
| Data | Supabase Postgres, Auth, Row Level Security, TanStack Query 5 |
| AI | Vercel AI SDK 6, Google Gemini, OpenAI |
| Forms and validation | React Hook Form, Zod |
| Charts | Recharts |
| Reports and messaging | Resend, React Email, Telegram Bot API |
| Testing | Vitest, Playwright |
| Hosting and schedules | Vercel, Vercel Cron |

## Project structure

```text
app/
  (app)/                 Authenticated pages
  (auth)/                Login flow
  api/                   Authenticated APIs, AI routes, Telegram, and cron jobs
components/              Shared UI and feature components
hooks/                   Reusable client data and interaction hooks
lib/
  finance/               Deterministic analysis and reporting engine
  server/                Authentication and cron authorization helpers
  supabase/              Browser, server, admin clients, and generated types
supabase/migrations/     Ordered database migrations
e2e/                     Desktop and mobile Playwright journeys
public/                  PWA icons and service worker
```

Authenticated route folders follow a colocation convention: `page.tsx` handles
composition while `_components/`, `_hooks/`, `_types/`, and `_lib/` hold
route-private implementation details.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Supabase project
- At least one AI provider key for AI features
- Optional Telegram, Resend, and exchange-rate credentials for those features

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and replace the placeholders.

3. Apply the SQL files in `supabase/migrations/` to the target Supabase project
   in filename order, using the Supabase CLI or SQL Editor.

4. Configure Supabase Auth URLs for local development:

   ```text
   Site URL:     http://localhost:3000
   Redirect URL: http://localhost:3000/auth/callback
   ```

   Add the equivalent production callback URL when deploying.

5. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

`.env.example` is the authoritative template. Never expose server-only values
through a `NEXT_PUBLIC_` variable.

| Capability | Variables |
| --- | --- |
| Supabase client | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Supabase admin/background jobs | `SUPABASE_SERVICE_ROLE_KEY` |
| Google AI | `GOOGLE_GENERATIVE_AI_API_KEY`, optional `GEMINI_CHAT_MODEL`, `GEMINI_FAST_MODEL` |
| OpenAI | `OPENAI_API_KEY`, optional `OPENAI_CHAT_MODEL`, `OPENAI_FAST_MODEL` |
| Exchange rates | `EXCHANGE_RATE_API_KEY` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` |
| Monthly report email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Application links | `NEXT_PUBLIC_APP_URL` |
| Cron authorization | `CRON_SECRET` |

If both AI providers are configured, the user-selected provider runs first and
the other provider can serve as a fallback. Provider API keys remain on the
server.

## Quality checks

```bash
npm test                 # Vitest unit and migration regression tests
npm run test:watch       # Vitest watch mode
npm run lint             # ESLint
npx tsc --noEmit         # TypeScript type check
npm run build            # Production build
npm run test:e2e         # Playwright desktop and mobile projects
```

Install the Playwright browsers once:

```bash
npx playwright install chromium webkit
```

Public end-to-end tests run without credentials. Authenticated journeys require
`E2E_EMAIL` and `E2E_PASSWORD`; the setup project signs in once and reuses the
saved session across workers. In PowerShell:

```powershell
$env:E2E_EMAIL = "you@example.com"
$env:E2E_PASSWORD = "your-password"
npm run test:e2e
```

Set `PLAYWRIGHT_BASE_URL` to test an already-running server. Otherwise,
Playwright builds and starts the production app automatically.

## AI Money Coach architecture

The language model does not calculate financial values. The deterministic
engine under `lib/finance/analysis/` uses `decimal.js`, creates a privacy-safe
snapshot, and limits AI involvement to phrasing approved facts.

```text
transactions + budgets
  -> deterministic analysis engine
  -> privacy-safe snapshot (no raw transaction rows or account identity)
  -> optional AI phrasing
  -> structured-output validation
  -> stored insight
  -> Review / Apply / Snooze / Dismiss
  -> explicit confirmation before any financial write
```

AI recommendations never silently change transactions, budgets, or savings
goals. Applying a recommendation requires a confirmation dialog that shows the
current value, proposed value, and expected monthly impact.

## Security model

- Supabase Row Level Security is the primary user-data boundary.
- API routes authenticate the user before server-side finance or AI work.
- `SUPABASE_SERVICE_ROLE_KEY`, AI keys, Telegram secrets, Resend keys, and
  `CRON_SECRET` are server-only.
- Every `/api/cron/*` route requires `Authorization: Bearer <CRON_SECRET>`.
- AI input uses a minimized finance snapshot; provider output is validated
  before it is stored or shown as an actionable insight.
- CSV exports neutralize leading formula characters before download.

## Cron jobs

`vercel.json` is the authoritative schedule. All times below are UTC.

| Endpoint | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/recurring` | Daily 00:00 | Create due recurring transactions |
| `/api/cron/savings` | Daily 00:30 | Send or apply due savings contributions |
| `/api/cron/cleanup-exchange-rates` | Sunday 03:00 | Delete exchange rates older than 30 days |
| `/api/cron/budget-alerts` | Daily 10:00 | Send budget threshold and overspend alerts |
| `/api/cron/daily-reminder` | Daily 03:00 and 12:00 | Send Telegram expense-logging reminders |
| `/api/cron/spending-spike` | Daily 12:00 | Alert on unusually high daily spending |
| `/api/cron/weekly-summary` | Monday 00:00 | Send the weekly financial check-in |
| `/api/cron/monthly-report` | Daily 02:00 | Deliver each user's completed local month report |

The monthly route runs daily because each user's completed month depends on
their timezone. Delivery is idempotent per user, month, and channel.

Test a cron locally with the same secret configured in `.env.local`:

```bash
curl http://localhost:3000/api/cron/recurring \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## Deployment

1. Connect the repository to Vercel.
2. Add the required environment variables for each deployment environment.
3. Apply pending Supabase migrations before enabling features that depend on
   them.
4. Register the production Supabase Auth callback URL.
5. Register the Telegram webhook through `/api/telegram/setup` when Telegram is
   enabled.
6. Deploy the `main` branch; Vercel reads the schedules from `vercel.json`.

The user-facing version is also available from `/api/version` and displayed in
Settings.
