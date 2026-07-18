alter table public.savings_goals
  add column if not exists reminder_day smallint not null default 1
    check (reminder_day between 1 and 28),
  add column if not exists last_reminder_month text
    check (last_reminder_month is null or last_reminder_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  add column if not exists last_contribution_month text
    check (last_contribution_month is null or last_contribution_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  add column if not exists skipped_month text
    check (skipped_month is null or skipped_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Preserve the meaning of any auto-deposit already recorded this month. From
-- this migration onward, auto_monthly_usd is a planned amount only.
update public.savings_goals
set last_contribution_month = last_auto_month
where last_contribution_month is null
  and last_auto_month is not null;

create table public.savings_contributions (
  id uuid primary key,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_usd numeric not null check (amount_usd > 0),
  contribution_month text not null
    check (contribution_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  source text not null check (source in ('manual', 'planned')),
  created_at timestamptz not null default now()
);

create index savings_contributions_user_created_idx
  on public.savings_contributions (user_id, created_at desc);

create index savings_contributions_goal_created_idx
  on public.savings_contributions (goal_id, created_at desc);

create unique index savings_contributions_one_planned_per_month_idx
  on public.savings_contributions (goal_id, contribution_month)
  where source = 'planned';

alter table public.savings_contributions enable row level security;

create policy "Users view own savings contributions"
  on public.savings_contributions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.savings_contributions from public, anon, authenticated;
grant select on table public.savings_contributions to authenticated;
grant select, insert, update, delete on table public.savings_contributions to service_role;

create or replace function public.record_savings_contribution(
  p_goal_id uuid,
  p_amount_usd numeric,
  p_source text,
  p_request_id uuid
)
returns table (
  new_total numeric,
  applied_amount numeric,
  achieved boolean,
  applied boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_month text := to_char(clock_timestamp() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_inserted_amount numeric;
  v_new_total numeric;
  v_target numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_goal_id is null or p_request_id is null then
    raise exception 'Goal and request IDs are required';
  end if;
  if p_amount_usd is null or p_amount_usd <= 0 or p_amount_usd > 1000000000000 then
    raise exception 'Contribution amount is invalid';
  end if;
  if p_source not in ('manual', 'planned') then
    raise exception 'Contribution source is invalid';
  end if;

  insert into public.savings_contributions (
    id,
    goal_id,
    user_id,
    amount_usd,
    contribution_month,
    source
  )
  values (
    p_request_id,
    p_goal_id,
    v_user_id,
    p_amount_usd,
    v_month,
    p_source
  )
  on conflict do nothing
  returning amount_usd into v_inserted_amount;

  if v_inserted_amount is null then
    select goal.current_usd, goal.target_usd
    into v_new_total, v_target
    from public.savings_goals goal
    where goal.id = p_goal_id
      and goal.user_id = v_user_id;

    if not found then
      raise exception 'Savings goal not found';
    end if;

    return query select v_new_total, 0::numeric, v_new_total >= v_target, false;
    return;
  end if;

  update public.savings_goals goal
  set
    current_usd = goal.current_usd + v_inserted_amount,
    last_contribution_month = case
      when p_source = 'planned' then v_month
      else goal.last_contribution_month
    end,
    skipped_month = case
      when p_source = 'planned' then null
      else goal.skipped_month
    end,
    updated_at = clock_timestamp()
  where goal.id = p_goal_id
    and goal.user_id = v_user_id
  returning goal.current_usd, goal.target_usd
  into v_new_total, v_target;

  if not found then
    raise exception 'Savings goal not found';
  end if;

  return query select v_new_total, v_inserted_amount, v_new_total >= v_target, true;
end;
$$;

revoke all on function public.record_savings_contribution(uuid, numeric, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_savings_contribution(uuid, numeric, text, uuid)
  to authenticated, service_role;

comment on column public.savings_goals.auto_monthly_usd is
  'Planned monthly contribution. It never changes the balance automatically.';
comment on table public.savings_contributions is
  'Immutable ledger of confirmed savings deposits.';
