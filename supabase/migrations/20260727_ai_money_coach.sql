-- AI Money Coach: insight persistence, user AI/notification preferences,
-- description aliasing, and subscription review status.
--
-- All monetary figures referenced by these tables are computed by the
-- deterministic engine in lib/finance/analysis/ — these tables only store
-- the AI's phrasing of already-verified numbers and the user's decisions.

-- ── 1. ai_financial_insights ────────────────────────────────────────────
-- One row per generated insight card (positive / warning / action). The AI
-- only ever writes `title`/`summary`; every number in `evidence` comes from
-- the engine. Nothing here is ever silently applied to transactions,
-- budgets, or goals — `status` tracks the user's own decision.

create table if not exists public.ai_financial_insights (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references auth.users(id) on delete cascade,
  period_start                    date not null,
  period_end                      date not null,
  insight_type                    text not null check (insight_type in (
                                     'positive_trend', 'category_overspend', 'budget_recommendation',
                                     'subscription_review', 'savings_goal', 'small_purchases',
                                     'duplicate_transaction', 'income_baseline', 'unusual_transaction',
                                     'double_counting', 'general'
                                   )),
  severity                        text not null check (severity in ('positive', 'info', 'warning', 'critical')),
  title                           text not null,
  summary                         text not null,
  evidence                        jsonb not null default '{}'::jsonb,
  estimated_monthly_savings_krw   numeric,
  confidence                      text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  status                          text not null default 'new' check (status in ('new', 'reviewed', 'accepted', 'dismissed', 'snoozed')),
  snoozed_until                   timestamptz,
  expires_at                      timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table public.ai_financial_insights enable row level security;

create policy "Users manage own AI insights"
  on public.ai_financial_insights
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.ai_financial_insights to authenticated;
grant select, insert, update, delete on public.ai_financial_insights to service_role;

create index if not exists ai_financial_insights_user_status_idx
  on public.ai_financial_insights (user_id, status);
create index if not exists ai_financial_insights_user_created_idx
  on public.ai_financial_insights (user_id, created_at desc);
create index if not exists ai_financial_insights_period_idx
  on public.ai_financial_insights (user_id, period_start, period_end);

create trigger update_ai_financial_insights_updated_at
  before update on public.ai_financial_insights
  for each row
  execute procedure public.update_updated_at_column();


-- ── 2. financial_preferences ────────────────────────────────────────────
-- One row per user. Controls AI coaching, notification thresholds, quiet
-- hours, and what's shared with the AI provider.

create table if not exists public.financial_preferences (
  user_id                     uuid primary key references auth.users(id) on delete cascade,
  target_savings_rate         numeric not null default 20 check (target_savings_rate >= 0 and target_savings_rate <= 100),
  monthly_spending_limit_krw  numeric,
  ai_coach_enabled            boolean not null default true,
  weekly_review_enabled       boolean not null default true,
  monthly_review_enabled      boolean not null default true,
  share_descriptions_with_ai  boolean not null default true,
  budget_warning_thresholds   jsonb not null default '{"first": 70, "strong": 90, "over": 100}'::jsonb,
  quiet_hours                 jsonb not null default '{"enabled": false, "start": "22:00", "end": "08:00", "timezone": "Asia/Seoul"}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.financial_preferences enable row level security;

create policy "Users manage own financial preferences"
  on public.financial_preferences
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.financial_preferences to authenticated;
grant select, insert, update, delete on public.financial_preferences to service_role;

create trigger update_financial_preferences_updated_at
  before update on public.financial_preferences
  for each row
  execute procedure public.update_updated_at_column();


-- ── 3. transaction_description_aliases ──────────────────────────────────
-- User-confirmed grouping of description variants (e.g. "Claude " / "claude"
-- / "CLAUDE"). Never edits the underlying transactions — analytics code
-- joins against this table to fold variants together only when reporting.

create table if not exists public.transaction_description_aliases (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  canonical_description text not null,
  variant_description   text not null,
  normalized_key        text not null,
  created_at            timestamptz not null default now(),
  unique (user_id, normalized_key)
);

alter table public.transaction_description_aliases enable row level security;

create policy "Users manage own description aliases"
  on public.transaction_description_aliases
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.transaction_description_aliases to authenticated;
grant select, insert, update, delete on public.transaction_description_aliases to service_role;

create index if not exists transaction_description_aliases_user_idx
  on public.transaction_description_aliases (user_id);


-- ── 4. subscription_status ──────────────────────────────────────────────
-- Persists the user's Keep / Review / Plan to Cancel / Cancelled decision
-- for a detected subscription candidate. Candidates themselves are derived
-- dynamically by the engine on each request — this table only stores the
-- decision, keyed by the engine's stable candidate key.

create table if not exists public.subscription_status (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  subscription_key  text not null,
  display_name      text not null,
  status            text not null default 'review' check (status in ('keep', 'review', 'plan_to_cancel', 'cancelled')),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, subscription_key)
);

alter table public.subscription_status enable row level security;

create policy "Users manage own subscription status"
  on public.subscription_status
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.subscription_status to authenticated;
grant select, insert, update, delete on public.subscription_status to service_role;

create index if not exists subscription_status_user_idx
  on public.subscription_status (user_id);

create trigger update_subscription_status_updated_at
  before update on public.subscription_status
  for each row
  execute procedure public.update_updated_at_column();
