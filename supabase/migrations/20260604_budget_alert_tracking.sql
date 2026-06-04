-- Dedup state for Telegram budget alerts.
-- alert_level: 0 = none sent this month, 1 = 80% warning sent, 2 = over-budget sent.
-- alert_month: the 'YYYY-MM' the level applies to (resets implicitly each month).

alter table public.budgets
  add column if not exists alert_month text,
  add column if not exists alert_level int not null default 0;
