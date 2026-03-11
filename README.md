# Money Flow

Money Flow is a mobile-first personal finance tracker built with Next.js 16, React 19, Tailwind CSS 4, and Supabase.

It includes:
- Email/password authentication with Supabase
- Dashboard summary for income, expense, balance, and category breakdown
- Transaction list with search, filters, pagination, and swipe-to-delete
- Analytics charts built with Recharts
- Settings page with profile photo upload, categories, payment methods, theme toggle, and CSV export
- PWA metadata for mobile install support

## Tech Stack

- Next.js 16.1.6
- React 19.2.3
- TypeScript
- Tailwind CSS 4
- Supabase Auth + Database
- React Hook Form + Zod
- Framer Motion
- Recharts

## Project Structure

```text
app/
  (app)/                Authenticated app pages
  (auth)/login/         Login and signup UI
  api/                  Route handlers for exchange rate, export, summary, transactions
  auth/callback/        Supabase auth callback route
components/
  layout/               Sidebar and bottom tab bar
  transactions/         Add transaction bottom sheet
  ui/                   FAB, avatar, skeleton, bottom sheet
lib/
  profile.ts            Sync and load user profile from public.users
  supabase.ts           Browser Supabase client + database types
  supabase-server.ts    Server Supabase client
  utils.ts              Formatting, haptics, image resize helpers
public/
  manifest.json         PWA manifest
supabase/migrations/
  20260311_users_profile_update.sql
```

## Requirements

- Node.js 20+
- npm
- Supabase project
- Optional: ExchangeRate API key

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXCHANGE_RATE_API_KEY=your_exchange_rate_api_key
```

Notes:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required.
- `EXCHANGE_RATE_API_KEY` is optional, but without it the exchange-rate route will not return live data.

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Other scripts:

```bash
npm run lint
npm run build
npm run start
```

## Supabase Setup

### 1. Auth

Enable Email auth in Supabase.

This app uses Supabase Auth as the source of identity, then syncs profile data into `public.users`.

### 2. Core Tables

You should have these tables:
- `users`
- `transactions`
- `categories`
- `payment_methods`
- `exchange_rates`

### 3. Users Table

The app expects `public.users.id` to match `auth.users.id`.

Recommended schema:

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

If you already created `public.users` with a random UUID default, run the migration in:

[`supabase/migrations/20260311_users_profile_update.sql`](./supabase/migrations/20260311_users_profile_update.sql)

It does:
- remove the default UUID generation from `users.id`
- add `avatar_url`
- add the foreign key to `auth.users(id)`

If PostgREST does not detect the new column immediately, run:

```sql
notify pgrst, 'reload schema';
```

### 4. Existing Users Table Data

If your existing row IDs in `public.users` do not match `auth.users.id`, you must fix them.

Check auth users:

```sql
select id, email from auth.users;
```

Then update or recreate the matching row in `public.users` using the same `id`.

## Recommended RLS Policies

Enable RLS on `public.users`:

```sql
alter table public.users enable row level security;
```

Recommended policies:

```sql
create policy "Users can read own profile"
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.users
for insert
to authenticated
with check (auth.uid() = id);
```

You should apply similar ownership policies to:
- `transactions`
- `categories`
- `payment_methods`

## How Profile Sync Works

- User signs up or signs in with Supabase Auth
- The app ensures a matching row exists in `public.users`
- Dashboard and settings read profile data from `public.users`
- Avatar upload stores a base64 image string in `public.users.avatar_url`

Relevant files:
- [`lib/profile.ts`](./lib/profile.ts)
- [`app/(auth)/login/page.tsx`](./app/(auth)/login/page.tsx)
- [`app/auth/callback/route.ts`](./app/auth/callback/route.ts)
- [`app/(app)/settings/page.tsx`](./app/(app)/settings/page.tsx)

## Main Features

### Dashboard

- Greeting and profile avatar
- Monthly income, expense, and balance
- Budget usage bar
- Daily trend chart
- Spending by category chart
- Recent transactions preview

### Transactions

- Add transaction bottom sheet
- Search by description
- Filter by income/expense
- Pagination
- Swipe left to reveal delete action

### Analytics

- 6-month income vs expense
- Net cash flow line chart
- Category distribution
- Summary cards

### Settings

- Profile photo upload
- Theme toggle
- Category management
- Payment method management
- CSV export
- Sign out

## API Routes

- `GET /api/exchange-rate`
  Returns exchange rate data

- `GET /api/export`
  Exports user transactions to CSV

- `GET /api/summary`
  Returns summary data

- `GET|POST|PATCH|DELETE /api/transactions`
  Transaction CRUD

## Mobile / PWA Notes

- PWA metadata is defined in:
  - [`app/layout.tsx`](./app/layout.tsx)
  - [`public/manifest.json`](./public/manifest.json)
- Icons are in:
  - [`public/icon.png`](./public/icon.png)
  - [`public/apple-icon.png`](./public/apple-icon.png)
- Layout is optimized for mobile with safe-area support and bottom navigation

## Known Notes

- Avatar images are currently stored as a base64 string in `public.users.avatar_url`.
  This is simple for now, but Supabase Storage is a better long-term choice.

- `npm run lint` currently passes without errors, but there are still some warnings in unrelated files.

## Deployment

Typical flow:

1. Create a Supabase project
2. Apply schema and policies
3. Set environment variables
4. Build and deploy the Next.js app

For production:
- use real Supabase credentials
- enable proper RLS policies
- consider moving avatar uploads to Supabase Storage
- review exchange-rate API usage and limits

## Git

Repository remote:

```text
https://github.com/Hen-Heang/money-flow.git
```
