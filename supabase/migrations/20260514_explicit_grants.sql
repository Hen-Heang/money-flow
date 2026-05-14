-- Explicit grants required by Supabase Data API change (effective Oct 30, 2026).
-- Without these, PostgREST/supabase-js returns 42501 on new projects from May 30
-- and on all existing projects from October 30.

-- ── users ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.users to service_role;

-- ── transactions ───────────────────────────────────────────────────────────
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.transactions to service_role;

-- ── categories ─────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.categories to service_role;

-- ── payment_methods ────────────────────────────────────────────────────────
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.payment_methods to service_role;

-- ── budgets ────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.budgets to service_role;

-- ── savings_goals ──────────────────────────────────────────────────────────
grant select, insert, update, delete on public.savings_goals to authenticated;
grant select, insert, update, delete on public.savings_goals to service_role;

-- ── recurring_transactions ─────────────────────────────────────────────────
grant select, insert, update, delete on public.recurring_transactions to authenticated;
grant select, insert, update, delete on public.recurring_transactions to service_role;

-- ── transaction_templates ──────────────────────────────────────────────────
grant select, insert, update, delete on public.transaction_templates to authenticated;
grant select, insert, update, delete on public.transaction_templates to service_role;

-- ── push_subscriptions ─────────────────────────────────────────────────────
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

-- ── exchange_rates ─────────────────────────────────────────────────────────
-- Read-only for all roles; writes handled server-side (service_role only).
grant select on public.exchange_rates to anon;
grant select on public.exchange_rates to authenticated;
grant select, insert, update, delete on public.exchange_rates to service_role;
