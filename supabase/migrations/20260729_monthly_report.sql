-- Monthly financial report: delivery preferences + delivery audit log.
--
-- The report content itself is computed on demand by
-- lib/finance/server/monthly-report.ts (deterministic engine, nothing
-- stored here is a source of truth for numbers). This migration only adds:
--   1. Per-user delivery preferences (which channels, which email address).
--   2. An audit log of every delivery attempt, used both to show delivery
--      history and to make the monthly cron idempotent (unique per
--      user/month/channel — a duplicate cron run cannot double-send).

-- ── 1. financial_preferences: monthly report delivery settings ─────────────

alter table public.financial_preferences
  add column if not exists monthly_report_channel_telegram boolean not null default true,
  add column if not exists monthly_report_channel_email    boolean not null default false,
  add column if not exists monthly_report_email            text;

-- ── 2. monthly_report_deliveries ────────────────────────────────────────────

create table if not exists public.monthly_report_deliveries (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  report_month          text not null check (report_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  channel               text not null check (channel in ('telegram', 'email')),
  status                text not null check (status in ('pending', 'sent', 'failed')),
  provider_message_id   text,
  error_message         text,
  attempted_at          timestamptz not null default now(),
  delivered_at          timestamptz,
  unique (user_id, report_month, channel)
);

alter table public.monthly_report_deliveries enable row level security;

-- Delivery attempts are written by the cron job (service_role) only. Users
-- may read their own history but never write it directly.
create policy "Users view own monthly report deliveries"
  on public.monthly_report_deliveries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.monthly_report_deliveries to authenticated;
grant select, insert, update, delete on public.monthly_report_deliveries to service_role;

create index if not exists monthly_report_deliveries_user_month_idx
  on public.monthly_report_deliveries (user_id, report_month);
