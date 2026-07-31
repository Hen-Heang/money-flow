# Money Flow — Project Guide & Workflow

This document explains **what** the project is, **how** it's organized, and **the workflow** to follow whenever you change it. Read top-to-bottom once, then use it as a reference.

---

## 1. What is Money Flow?

A personal-finance PWA: track income/expenses, set monthly budgets, view analytics, get AI insights, and receive push notifications. Mobile-first, installable, works offline. Live at [money-flow.henheang.site](https://money-flow.henheang.site).

### Core domain (memorize these)

| Entity | Meaning |
| --- | --- |
| **Transaction** | One income or expense row — date, amount, category, payment method |
| **Category** | "Food", "Drink", "Travel"… — has icon + color, scoped to income/expense/both |
| **Payment Method** | "Bank", "Card", "Cash"… — what the money came from / went to |
| **Budget** | Monthly limit per category |
| **Savings Goal** | Target amount + auto-deposit schedule |
| **Recurring** | Template that auto-creates a transaction on a cron |

---

## 2. Tech Stack (one line each)

- **Next.js 16 (App Router)** — pages, layouts, server components, API routes
- **React 19** — UI
- **TypeScript** — types everywhere; domain types live in [lib/types.ts](lib/types.ts)
- **Tailwind CSS 4** — styling via utility classes + CSS variables
- **Supabase** — Postgres + Auth + Row-Level Security (primary DB)
- **Framer Motion** — animations + drag/swipe gestures
- **Recharts** — analytics charts
- **React Hook Form + Zod** — form state + validation
- **Vercel AI SDK + Google Gemini** — AI chat & category suggestion
- **Geist Sans / Geist Mono** — fonts (already wired in [app/layout.tsx](app/layout.tsx))

---

## 3. Folder Map

```
money-flow/
├── app/                         # Next.js App Router
│   ├── (app)/                   # Authenticated app routes (uses AuthGuard layout)
│   │   ├── dashboard/           # Home — summary, insights, recent activity
│   │   ├── transactions/        # List, search, filter, swipe-edit
│   │   ├── analytics/           # Charts (Recharts) — trends + monthly summary views
│   │   ├── budget/              # Monthly limits per category
│   │   ├── savings/             # Goals + auto-deposit
│   │   ├── review/              # Month-end review + adaptive next-month budget plan
│   │   ├── subscriptions/       # Detected recurring payments (Keep/Review/Cancel)
│   │   ├── settings/            # Theme, profile, categories, telegram, export, logout
│   │   │   └── ai/              # AI Money Coach preferences (thresholds, privacy)
│   │   ├── error.tsx            # Segment-level error boundary
│   │   ├── loading.tsx (per route) # Route-level skeletons
│   │   └── layout.tsx           # Wraps with NavShell (TabBar / Sidebar) + ErrorBoundary
│   ├── (auth)/login/            # Public login page (Supabase OAuth)
│   ├── api/                     # API routes (server-only)
│   │   ├── ai/                  # suggest-category, parse-transaction, insights
│   │   ├── chat/                # AI chat streaming
│   │   ├── cron/                # Vercel cron-triggered jobs (need CRON_SECRET)
│   │   ├── exchange-rate/       # Cached KRW↔USD rate
│   │   ├── export/              # CSV / JSON export
│   │   ├── finance/             # aliases, budget-plan, goal-plans, monthly-review, preferences, subscriptions
│   │   ├── recurring/           # CRUD for recurring templates
│   │   ├── settings/ai-provider/# Switch Gemini/OpenAI
│   │   ├── telegram/            # Webhook + link/unlink + setup
│   │   ├── transactions/        # Bulk ops / mobile fetch
│   │   └── version/             # Build version check
│   ├── auth/callback/           # Supabase OAuth callback
│   ├── layout.tsx               # Root: fonts, theme init, toaster
│   ├── global-error.tsx         # Root-level error boundary (own <html>/<body>)
│   ├── not-found.tsx            # Global 404
│   ├── globals.css              # CSS variables (colors, fonts, spacing)
│   ├── manifest.ts              # PWA manifest (single source of truth)
│   └── page.tsx                 # Redirects → /dashboard
│
├── components/
│   ├── ai/                      # ChatBot / chat launcher components
│   ├── layout/                  # NavShell, TabBar (mobile), Sidebar (desktop)
│   ├── transactions/            # AddTransactionSheet/, CategoryGrid, SwipeableRow, RecurringSheet
│   ├── ui/                      # BottomSheet, FAB, Avatar, Skeleton, NumericKeypad, ErrorBoundary, …
│   └── AuthGuard.tsx            # Client-side auth check
│
├── hooks/                       # Custom React hooks (one concern each)
│   ├── useBudgets.ts            # Fetch + cache budgets
│   ├── useCategories.ts         # Categories for current user
│   ├── useExchangeRate.ts       # Live KRW/USD with fallback
│   ├── useIsMobile.ts           # Window-width breakpoint
│   ├── useKeyboardShortcuts.ts  # Global hotkeys (n, /, Esc)
│   ├── useMonthNavigation.ts    # Prev/next month state
│   ├── usePullToRefresh.ts      # Mobile pull-to-refresh
│   ├── useSupabaseClient.ts     # Memoized client
│   ├── useTransactionForm.ts    # Add/edit form state
│   ├── useTransactionSync.ts    # Cross-component "transactions changed" pub/sub
│   └── useDescriptionSuggestions.ts # Learned description → category/payment-method
│
├── lib/                         # Pure utilities + thin clients
│   ├── env/                     # client.ts / server.ts — validated env var access
│   ├── supabase/                # client.ts / server.ts / admin.ts / database.types.ts
│   ├── server/                  # requireUser(), requireCronAuthorization() — route helpers
│   ├── finance/                 # Deterministic analysis engine (see §AI Money Coach)
│   ├── constants.ts             # App-wide constants
│   ├── dateHelpers.ts           # Date math, range builders
│   ├── profile.ts               # Current user profile helpers
│   ├── rate-limit.ts            # In-memory rate limiter for API routes
│   ├── ai-provider.ts           # Gemini/OpenAI model resolution + fallback
│   ├── telegram.ts              # Telegram bot API + service-role client
│   ├── email.ts                 # Monthly report email delivery (Resend)
│   ├── types.ts                 # Domain types — import from here, don't redeclare
│   └── utils.ts                 # formatKRW, formatUSD, haptic, cn (clsx+tw-merge)
│
├── shared/                      # Constants used by client AND server
│   ├── data.ts                  # Seed categories, payment methods
│   └── presets.ts               # Page size, fallback exchange rate, search history cap
│
├── supabase/migrations/         # SQL migrations (applied via Supabase dashboard / CLI)
├── scripts/                     # One-off scripts (seed, etc.)
├── public/                      # PWA icons, service worker (manifest served from app/manifest.ts)
├── proxy.ts                     # Next.js middleware-style proxy (auth checks)
├── next.config.ts               # Image / header / CSP config
└── package.json
```

Route-heavy pages under `app/(app)/<feature>/` follow a colocation convention:
`page.tsx` (composition only) + `_components/`, `_hooks/`, `_types/`, `_lib/` (route-private,
excluded from routing by the `_` prefix). See `savings/`, `analytics/`, `settings/`, or
`transactions/` for examples.

---

## 4. Data Flow (mental model)

```
                    ┌──────────────┐
   User action  ─►  │  Component   │ ── calls ──► Supabase JS client (RLS protects rows)
                    └──────┬───────┘
                           │ for AI / cron / export
                           ▼
                    ┌──────────────┐
                    │  API route   │ ── auth check ──► Supabase (user or service-role) / Gemini / OpenAI
                    └──────────────┘
```

- **Reads in client components** → Supabase JS client directly (RLS = user only sees own rows)
- **Writes that need server logic** (AI, cron, export) → `/api/…` route
- **Cron jobs** run on Vercel, hit `/api/cron/*` with `Authorization: Bearer ${CRON_SECRET}`

---

## 5. Conventions (follow these)

### Naming & files
- Pages → `page.tsx`, layouts → `layout.tsx`, loading → `loading.tsx`
- Client components → `'use client'` on line 1
- Components in PascalCase, hooks `useThing` in camelCase
- Domain types from [lib/types.ts](lib/types.ts) — **never redefine** `Transaction`, `Category`, etc.

### Styling
- Tailwind utilities first
- Colors via CSS variables (`var(--color-bg)`, `var(--color-text-primary)`, …) so light/dark theme works
- Numbers use `tabular-nums` (and ideally `font-mono`) so digits align
- Mobile-first: design for ~390px wide, scale up with `sm:` / `md:` / `lg:`

### Animations
- Use Framer Motion for any movement
- Standard transition: `{ type: 'spring', stiffness: 300, damping: 30 }`
- Tap feedback: `active:scale-95` + `haptic('light')`

### State
- Local UI → `useState`
- Forms → `react-hook-form` + `zod` schema
- Server data → fetch in component or hook, cache in state, no global store yet
- Persistence beyond a tab → `localStorage` (search history, theme) or Supabase

### Errors & toasts
- User-visible errors → `toast.error(...)`
- Wrap risky UI in `<ErrorBoundary>` from [components/ui/ErrorBoundary.tsx](components/ui/ErrorBoundary.tsx)
- API routes: return `{ error: '…' }` with proper status; never leak DB error messages

### Security
- Never use `SUPABASE_SERVICE_ROLE_KEY` in any file under `app/(app)` or `components/` — server-only
- All `/api/cron/*` must check `Authorization` header
- Validate API input with Zod schemas

---

## 6. Workflow: Adding a new feature

Use this checklist every time. It will save you debugging hours.

### Step 1 — Plan (5 min)
- One sentence: what does the user see / do?
- What domain entities does it touch? (transaction, budget, …)
- Does it need a DB column? a migration? an API route?

### Step 2 — Data model (if needed)
1. Write SQL in `supabase/migrations/YYYYMMDD_<feature>.sql`
2. Apply it (Supabase dashboard SQL editor, or `supabase db push`)
3. Add/update the type in [lib/types.ts](lib/types.ts)
4. Update RLS policies if it's a new table

### Step 3 — Server logic (if needed)
- New route under `app/api/<feature>/route.ts`
- Validate input with Zod
- Use [lib/server/auth.ts](lib/server/auth.ts)'s `requireUser()` for the auth check + user-scoped client
- Rate-limit if public-ish (`lib/rate-limit.ts`)

### Step 4 — UI
- Build pieces under `components/<area>/`
- Page lives under `app/(app)/<feature>/page.tsx`
- Use existing primitives: `BottomSheet`, `FAB`, `Skeleton`, `SwipeableRow`, `NumericKeypad`
- Use the existing hooks before writing new ones (`useBudgets`, `useCategories`, …)

### Step 5 — Polish
- Mobile-first: open Chrome DevTools → iPhone 12 Pro Max (390×844) and verify
- Add `haptic()` to taps
- Add a skeleton/empty state
- Test light + dark theme

### Step 6 — Verify
- `npx tsc --noEmit` → fix type errors
- `npm run lint`
- Click through the feature in `npm run dev`
- Check console for warnings

### Step 7 — Ship
- Commit with a clear message: `feat: add monthly export to CSV`
- Push to `main` → Vercel auto-deploys
- Add any new env vars in Vercel dashboard

---

## 7. Workflow: Fixing a bug

1. **Reproduce** in dev (`npm run dev`). If you can't reproduce, you can't fix.
2. **Locate** with Grep — find the symbol/text, not the file.
3. **Understand the root cause** — don't patch the symptom. Why is the bad value there?
4. **Minimal fix** — change only what's needed. No "while I'm here" refactors.
5. **Verify** the original repro is gone AND nothing nearby broke.
6. **Commit** with `fix: …` and a one-line description of the cause.

---

## 8. Local Development

```bash
npm install              # first time
npm run dev              # http://localhost:3000
npm run lint             # ESLint
npx tsc --noEmit         # type-check (no build output)
npm run build            # production build
```

Required `.env.local` keys (see README for full list):
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Exchange rate: `EXCHANGE_RATE_API_KEY`
- AI: `GOOGLE_GENERATIVE_AI_API_KEY`
- Cron: `CRON_SECRET`

---

## 9. Cron jobs

All require `Authorization: Bearer ${CRON_SECRET}` and run on Vercel (see `vercel.json` for the authoritative schedule).

| Endpoint | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/recurring` | Daily 00:00 UTC | Create recurring transactions |
| `/api/cron/savings` | Daily 00:30 UTC | Send/apply due monthly savings contributions |
| `/api/cron/cleanup-exchange-rates` | Sunday 03:00 UTC | Delete rates older than 30 days |
| `/api/cron/budget-alerts` | Daily 10:00 UTC | Budget overspend notifications |
| `/api/cron/daily-reminder` | Daily 03:00 & 12:00 UTC | Telegram expense-logging reminder |
| `/api/cron/spending-spike` | Daily 12:00 UTC | Alert on unusually high daily spend |
| `/api/cron/weekly-summary` | Monday 00:00 UTC | Weekly AI check-in |
| `/api/cron/monthly-report` | Daily 02:00 UTC | Monthly report (Telegram/email), idempotent per user/month/channel |

Test locally:
```bash
curl http://localhost:3000/api/cron/recurring -H "Authorization: Bearer <CRON_SECRET>"
```

---

## 10. Routes Map (quick reference)

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing page (redirects signed-in users to `/dashboard`) |
| `/login` | OAuth login |
| `/dashboard` | Home — summary cards, insights, recent activity |
| `/transactions` | Full list with search/filter/swipe actions |
| `/analytics` | Charts by category, period, payment method + monthly summary view |
| `/budget` | Set monthly limits |
| `/savings` | Goals + progress |
| `/review` | Month-end review + adaptive next-month budget plan |
| `/subscriptions` | Detected recurring payments (Keep/Review/Cancel) |
| `/settings` | Profile, theme, categories, telegram, export, logout |
| `/settings/ai` | AI Money Coach preferences (thresholds, privacy) |

---

## 11. Common pitfalls (learn from past mistakes)

- ❌ Defining `Transaction` inline in a component — always import from [lib/types.ts](lib/types.ts).
- ❌ Hardcoding colors (`text-white`, `bg-gray-900`) — use CSS variables so theme switching works.
- ❌ Forgetting `'use client'` on a component that uses `useState` or event handlers.
- ❌ Putting the service-role key in client code — it'll leak to every visitor.
- ❌ Missing RLS policy on a new table — without it, RLS denies all reads.
- ❌ Not testing on mobile width — desktop-only layouts break on iPhone.
- ❌ Adding heavy libraries to client bundle — check `next build` output for bundle bloat.

---

## 12. Where to look first

| You want to … | Open this |
| --- | --- |
| Add a new page | `app/(app)/<name>/page.tsx` |
| Add a new API route | `app/api/<name>/route.ts` |
| Change colors / theme | `app/globals.css` |
| Add a domain field | `lib/types.ts` + new migration |
| Change number formatting | `lib/utils.ts` (`formatKRW`, `formatUSD`) |
| Edit nav tabs | `components/layout/TabBar.tsx` / `Sidebar.tsx` |
| Customize the add form | `components/transactions/AddTransactionSheet.tsx` |
| Tune swipe actions | `components/transactions/SwipeableRow.tsx` |
| Adjust cron behavior | `app/api/cron/*` |

---

## 13. Roadmap (from our UX brainstorm)

Next-up polish ideas, ranked by impact ÷ effort:

1. ✅ Sticky date headers in transactions (done)
2. Animated number counters on totals (Framer Motion `useSpring`)
3. Quick-add bar that parses `"coffee 4500"` → amount + category
4. Skeleton loaders on every page
5. Pull-to-refresh on transactions list
6. Glassmorphism polish on bottom nav
7. Smart suggestions while typing description
8. Receipt OCR (Tesseract.js or Vision API)
9. Lock-screen widget via PWA manifest
10. View Transitions API for route changes

---

**TL;DR workflow:** plan → migration → API → UI → polish → tsc/lint → commit → push.
**TL;DR layout:** `app/` = routes, `components/` = UI pieces, `hooks/` = data + behavior, `lib/` = pure utils, `shared/` = constants used by both client and server.
