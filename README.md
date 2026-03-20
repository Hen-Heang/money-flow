# Money Flow

Money Flow is a personal finance tracker built with **Next.js 16**, **React 19**, and **Supabase**. It combines a glassmorphic design with AI capabilities for a seamless wealth management experience.

## Features

### AI-Powered Intelligence
- **Category Suggestion**: Uses Google Gemini 1.5 Flash to auto-suggest categories as you type
- **Financial Chatbot**: AI assistant with awareness of your spending habits
- **Smart Insights**: Monthly burn rate analysis and automated savings tips

### Transactions
- Add, edit, delete transactions (KRW / USD)
- Swipe to delete, bulk select and delete
- Search by description with history
- Filter by income / expense, sort by date or amount
- Pull-to-refresh on mobile
- Keyboard shortcuts: `N` new, `/` search, `Esc` close

### Dashboard
- Monthly income, expense, balance summary
- Budget usage bars with overspend alerts
- Daily trend area chart
- Spending by category pie chart
- Quick-add templates (Coffee, Lunch, Bus, Grocery)

### Analytics
- Income vs expense bar chart (1M / 3M / 6M periods)
- Net cash flow line chart
- Category breakdown with budget comparison
- Export current period as CSV

### Savings Goals
- Create goals with target amount, icon, and color
- Track progress with deposit history
- Confetti animation on goal completion

### Recurring Transactions
- Define daily / weekly / monthly / yearly rules
- One-tap apply to generate real transactions

### Settings
- Edit display name inline
- Upload profile photo (stored in Supabase Storage)
- Light / dark theme toggle
- Manage categories (income + expense) and payment methods
- Monthly budget limits per category
- Export data as CSV, JSON, or PDF
- Sign out

### Auth
- Email + password sign-up and sign-in
- **Google Sign-In** (OAuth via Supabase)
- New users get default categories and payment methods seeded automatically

### PWA
- Installable on iOS and Android
- Offline banner when connection is lost
- Manifest shortcuts for Add Transaction, Savings, Analytics
- Safe-area support for notched devices

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| Auth + DB | Supabase (Auth, PostgreSQL, Storage, RLS) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| AI | Google Gemini 1.5 Flash |
| Icons | Lucide React |

## Project Structure

```text
app/
  (app)/                Authenticated pages (dashboard, transactions, analytics, savings, settings)
  (auth)/login/         Login / sign-up UI
  api/                  Route handlers (exchange-rate, export, summary, transactions, recurring, chat, ai)
  auth/callback/        OAuth callback — exchanges code, creates user profile + seeds defaults
components/
  ai/                   ChatBot
  layout/               Sidebar and bottom tab bar
  transactions/         AddTransactionSheet, CategoryGrid, RecurringSheet
  ui/                   Avatar, BottomSheet, ErrorBoundary, FAB, OfflineBanner, Skeleton
hooks/
  useExchangeRate.ts    Shared exchange rate fetch hook
  useIsMobile.ts        Shared mobile breakpoint hook
  useKeyboardShortcuts.ts
  usePullToRefresh.ts
  useTransactionForm.ts
lib/
  constants.ts          CHART_COLORS and other shared constants
  profile.ts            User profile sync + default data seeding
  supabase.ts           Browser Supabase client
  supabase-server.ts    Server Supabase client
  types.ts              Shared TypeScript interfaces (Transaction, Category, PaymentMethod, Budget, ExchangeRateInfo)
  utils.ts              Formatting, haptics, image resize helpers
public/
  manifest.json         PWA manifest with shortcuts
supabase/migrations/
  *.sql                 Schema migrations
```

## Requirements

- Node.js 20+
- Supabase project
- Google Cloud project (for Google Sign-In and Gemini AI)
- Optional: ExchangeRate API key

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
EXCHANGE_RATE_API_KEY=your_exchange_rate_api_key
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required
- `GEMINI_API_KEY` is required for AI features
- `EXCHANGE_RATE_API_KEY` is optional — without it the exchange rate route uses a fallback value

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run lint
npm run build
npm run start
```

## Supabase Setup

### 1. Auth

Enable **Email** and **Google** providers in Supabase → Authentication → Providers.

For Google Sign-In:
1. Create OAuth credentials in Google Cloud Console
2. Add `https://<your-ref>.supabase.co/auth/v1/callback` as an authorised redirect URI
3. Paste Client ID and Secret into Supabase → Authentication → Providers → Google
4. Add your app URL to Supabase → Authentication → URL Configuration → Redirect URLs

### 2. Core Tables

```text
users
transactions
categories
payment_methods
budgets
savings_goals
recurring_transactions
transaction_templates
exchange_rates
```

### 3. Users Table

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  display_name varchar(100),
  avatar_url text,
  default_currency varchar(3) default 'KRW',
  created_at timestamp with time zone default now()
);
```

### 4. RLS Policies

Enable RLS on all tables. Example for `public.users`:

```sql
alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select to authenticated using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update to authenticated using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert to authenticated with check (auth.uid() = id);
```

Apply equivalent ownership policies to `transactions`, `categories`, `payment_methods`, `budgets`, `savings_goals`, and `recurring_transactions`.

### 5. Storage

Create a `avatars` bucket in Supabase Storage for profile photo uploads.

## How New User Onboarding Works

1. User signs up (email or Google) → Supabase Auth creates `auth.users` record
2. `app/auth/callback/route.ts` exchanges the OAuth code for a session
3. `lib/profile.ts → ensureUserProfile()` inserts a row into `public.users`
4. `seedDefaultUserData()` inserts 12 default categories (income + expense) and 4 payment methods for the new user
5. User lands on the dashboard with a fully populated app

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/exchange-rate` | Live KRW/USD rate |
| GET | `/api/export` | Export transactions as CSV or JSON |
| GET | `/api/summary` | Monthly summary |
| GET/POST/PATCH/DELETE | `/api/transactions` | Transaction CRUD |
| GET/POST/DELETE | `/api/recurring` | Recurring rules CRUD |
| POST | `/api/recurring/apply` | Apply recurring rules to generate transactions |
| POST | `/api/chat` | AI chatbot (Gemini) |
| POST | `/api/ai/suggest-category` | AI category suggestion |

## Deployment

1. Create a Supabase project and apply schema + RLS policies
2. Create a `avatars` storage bucket
3. Configure Google OAuth in Google Cloud Console and Supabase
4. Set all environment variables in your hosting platform
5. Deploy the Next.js app (Vercel recommended)

Add your production URL to:
- Supabase → Authentication → URL Configuration → Redirect URLs
- Google Cloud → OAuth 2.0 Client → Authorised JavaScript origins + Redirect URIs

## Repository

```
https://github.com/Hen-Heang/money-flow.git
```
