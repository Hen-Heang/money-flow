-- Document the Row Level Security already enforced live on the four core
-- tables (transactions, categories, payment_methods, users). These tables
-- predate the migrations folder, so their RLS setup existed only in the
-- dashboard and was not reviewable or reproducible from a fresh migration
-- run. This migration captures the exact policies currently in force
-- (verified against pg_policies) so they are version-controlled going
-- forward. `enable row level security` and `drop policy if exists` make
-- this safe to re-run against the existing project as well as a fresh one.

-- ── users ──────────────────────────────────────────────────────────────────
alter table public.users enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
  on public.users
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users
  for update
  to authenticated
  using ((select auth.uid()) = id);

-- ── transactions ───────────────────────────────────────────────────────────
alter table public.transactions enable row level security;

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions
  for update
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions
  for delete
  using ((select auth.uid()) = user_id);

-- ── categories ─────────────────────────────────────────────────────────────
-- `user_id is null` is included in the select policy for shared/default
-- categories with no owner; no row in the current data actually has a null
-- user_id, but the policy already allows for it live, so it is preserved here.
alter table public.categories enable row level security;

drop policy if exists "categories_select" on public.categories;
create policy "categories_select"
  on public.categories
  for select
  using ((select auth.uid()) = user_id or user_id is null);

drop policy if exists "categories_insert" on public.categories;
create policy "categories_insert"
  on public.categories
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories_update" on public.categories;
create policy "categories_update"
  on public.categories
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete"
  on public.categories
  for delete
  using ((select auth.uid()) = user_id);

-- ── payment_methods ────────────────────────────────────────────────────────
alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_select" on public.payment_methods;
create policy "payment_methods_select"
  on public.payment_methods
  for select
  using ((select auth.uid()) = user_id or user_id is null);

drop policy if exists "payment_methods_insert" on public.payment_methods;
create policy "payment_methods_insert"
  on public.payment_methods
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "payment_methods_update" on public.payment_methods;
create policy "payment_methods_update"
  on public.payment_methods
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "payment_methods_delete" on public.payment_methods;
create policy "payment_methods_delete"
  on public.payment_methods
  for delete
  using ((select auth.uid()) = user_id);
