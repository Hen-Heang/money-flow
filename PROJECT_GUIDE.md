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
│   │   ├── analytics/           # Charts (Recharts)
│   │   ├── budget/              # Monthly limits per category
│   │   ├── savings/             # Goals + auto-deposit
│   │   ├── report/              # Monthly report view
│   │   ├── settings/            # Theme, profile, push, export, logout
│   │   └── layout.tsx           # Wraps with NavShell (TabBar / Sidebar)
│   ├── (auth)/login/            # Public login page (Supabase OAuth)
│   ├── api/                     # API routes (server-only)
│   │   ├── ai/suggest-category/ # POST → Gemini suggests a category for a description
│   │   ├── chat/                # AI chat streaming
│   │   ├── cron/                # Vercel cron-triggered jobs (need CRON_SECRET)
│   │   ├── exchange-rate/       # Cached KRW↔USD rate
│   │   ├── export/              # CSV / JSON export
│   │   ├── recurring/           # CRUD for recurring templates
│   │   └── transactions/        # (used for bulk ops / mobile fetch)
│   ├── auth/callback/           # Supabase OAuth callback
│   ├── layout.tsx               # Root: fonts, theme init, toaster
│   ├── globals.css              # CSS variables (colors, fonts, spacing)
│   ├── manifest.ts              # PWA manifest
│   └── page.tsx                 # Redirects → /dashboard
│
├── components/
│   ├── ai/ChatBot.tsx           # Floating AI chat
│   ├── layout/                  # NavShell, TabBar (mobile), Sidebar (desktop)
│   ├── transactions/            # AddTransactionSheet, CategoryGrid, SwipeableRow, RecurringSheet
│   ├── ui/                      # BottomSheet, FAB, Avatar, Skeleton, NumericKeypad, …
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
│   └── useTransactionForm.ts    # Add/edit form state
│
├── lib/                         # Pure utilities + thin clients
│   ├── constants.ts             # App-wide constants
│   ├── dateHelpers.ts           # Date math, range builders
│   ├── neon.ts                  # Neon client (backup target)
│   ├── profile.ts               # Current user profile helpers
│   ├── rate-limit.ts            # In-memory rate limiter for API routes
│   ├── supabase.ts              # Browser Supabase client
│   ├── supabase-server.ts       # Server Supabase client (SSR cookies)
│   ├── types.ts                 # Domain types — import from here, don't redeclare
│   └── utils.ts                 # formatKRW, formatUSD, haptic, cn (clsx+tw-merge)
│
├── shared/                      # Constants used by client AND server
│   ├── data.ts                  # Seed categories, payment methods
│   └── presets.ts               # Page size, fallback exchange rate, search history cap
│
├── supabase/migrations/         # SQL migrations (applied via Supabase dashboard / CLI)
├── scripts/                     # One-off scripts (Neon schema, seed, etc.)
├── public/                      # PWA icons, manifest assets, service worker
├── proxy.ts                     # Next.js middleware-style proxy (auth checks)
├── next.config.ts               # PWA / image / header config
└── package.json
```

---

## 4. Data Flow (mental model)

```
                    ┌──────────────┐
   User action  ─►  │  Component   │ ── calls ──► Supabase JS client (RLS protects rows)
                    └──────┬───────┘
                           │ for AI / cron / export
                           ▼
                    ┌──────────────┐
                    │  API route   │ ── auth check ──► Supabase service-role / Gemini / Neon
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
- Use [lib/supabase-server.ts](lib/supabase-server.ts) for user-scoped queries
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

All require `Authorization: Bearer ${CRON_SECRET}` and run on Vercel.

| Endpoint | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/recurring` | Daily 00:00 UTC | Create recurring transactions |
| `/api/cron/savings` | 1st of month 09:30 UTC | Auto-deposit savings |
| `/api/cron/cleanup-exchange-rates` | Sunday 03:00 UTC | Delete rates older than 30 days |

Test locally:
```bash
curl http://localhost:3000/api/cron/recurring -H "Authorization: Bearer <CRON_SECRET>"
```

---

## 10. Routes Map (quick reference)

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/dashboard` |
| `/login` | OAuth login |
| `/dashboard` | Home — summary cards, insights, recent activity |
| `/transactions` | Full list with search/filter/swipe actions |
| `/analytics` | Charts by category, period, payment method |
| `/budget` | Set monthly limits |
| `/savings` | Goals + progress |
| `/report` | Monthly summary view |
| `/settings` | Profile, theme, export, logout |

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
