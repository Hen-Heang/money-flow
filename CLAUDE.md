## Git Attribution Rules

- Never add Claude, Anthropic, AI, or model attribution to Git commits.
- Never add `Co-Authored-By: Claude` trailers.
- Never add `Claude-Session` metadata.
- Never add `Generated with Claude Code`.
- Use only the configured human Git author for commits.

## Authentication & authorization rules

These rules govern how auth-related code is written and changed in this
project, by anyone — human or Claude. They reflect the patterns already
established in the codebase; don't introduce a second pattern alongside them.

### 1. API routes always derive identity from the session, never from input

- Every `app/api/**/route.ts` handler that touches user data must call
  `requireUser()` from `lib/server/auth.ts` and check `!user` before doing
  anything else. Return `401` on failure — don't let a route fall through to
  a query without this check.
- Never read `user_id` from the request body, query string, or a route
  param and use it to scope a query or write. The user id always comes from
  `user.id` on the session returned by `requireUser()`. If a payload
  includes a `user_id` field, strip it before persisting (see
  `sanitizeBody()` in `app/api/transactions/route.ts` for the pattern).
- Apply `.eq('user_id', user.id)` (or the table's equivalent) explicitly in
  reads and writes even though RLS also enforces this — defense in depth,
  not a replacement for RLS.

### 2. Cron and webhook routes use their own gates, not user sessions

- Every `app/api/cron/*/route.ts` handler must call
  `requireCronAuthorization(request)` from `lib/server/cron.ts` first, which
  checks `Authorization: Bearer <CRON_SECRET>` and fails closed if the
  secret is missing or doesn't match.
- The Telegram webhook (`app/api/telegram/route.ts`) validates Telegram's
  `x-telegram-bot-api-secret-token` against `TELEGRAM_WEBHOOK_SECRET`
  instead — it has no user session and no cron secret. Follow that same
  shape for any future inbound webhook: verify a shared secret/signature
  before doing anything with the payload.
- These routes use the service-role admin client (`createAdminClient()`)
  because there is no user session to scope queries by. That's the only
  place the admin client belongs — see rule 4.

### 3. Every user-data table ships RLS in the same migration that creates it

- A new table holding per-user data must `alter table ... enable row level
  security` and define `select`/`insert`/`update`/`delete` policies scoped
  to `(select auth.uid()) = user_id` (or the equivalent owner column) in the
  *same* migration file that creates the table — not as a follow-up, not
  left to be configured by hand in the dashboard.
- `supabase/migrations/20260813120000_core_tables_rls.sql` is the reference
  pattern: idempotent `drop policy if exists` + `create policy`, so it's
  safe to re-run. Match its style for new policies.
- If you ever find a table with data rows but no RLS-enabling migration in
  `supabase/migrations/`, that's a gap to close the same way — pull the live
  policy definitions from `pg_policies` and commit them, don't guess.
- Wrap `(select auth.uid())` in a subselect (not bare `auth.uid()`) per
  Supabase's performance guidance — this is what the existing policies do.

### 4. Secrets and the service-role client are server-only, always

- `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_WEBHOOK_SECRET`, `RESEND_API_KEY`, and AI provider keys never
  appear in a `NEXT_PUBLIC_` variable, a client component, or anything sent
  to the browser.
- `lib/supabase/admin.ts` (`createAdminClient`) is marked `import
  'server-only'` and is only ever imported from cron routes, the Telegram
  webhook, and a handful of named server-only helpers (`lib/telegram.ts`,
  `lib/ai-rate-limit.ts`, `app/api/exchange-rate/route.ts`). Don't import it
  from anything under `app/(app)/`, `components/`, or any `"use client"`
  file — use `lib/supabase/client.ts` (browser) or `lib/supabase/server.ts`
  (per-request, cookie-based) instead.
- AI provider calls stay server-side; the deterministic finance snapshot
  sent to a model is privacy-scrubbed (see README's AI Money Coach section)
  — don't add a code path that forwards raw transaction rows or account
  identity to a provider.

### 5. Don't weaken auth/authz silently

- Never remove, loosen, or bypass a `requireUser()` check, an RLS policy, a
  cron/webhook secret check, or the `user_id` stripping in `sanitizeBody()`
  as a side effect of an unrelated change (e.g. "simplifying" a route or
  fixing a lint error). If a task seems to require it, stop and ask instead
  of making the call silently — this is exactly the kind of change that
  needs explicit confirmation, not just a diff to review after the fact.
- Treat any new migration that touches `grant`, `policy`, or `row level
  security` statements as security-relevant: state plainly what it changes
  and why before applying it, even if it looks like a no-op.
