create policy "Users record own savings contributions"
  on public.savings_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant insert on table public.savings_contributions to authenticated;

create or replace function public.apply_savings_contribution_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_month text := to_char(clock_timestamp() at time zone 'Asia/Seoul', 'YYYY-MM');
begin
  if v_user_id is null or new.user_id <> v_user_id then
    raise exception 'Authentication required';
  end if;
  if new.contribution_month <> v_month then
    raise exception 'Contribution month must be the current month';
  end if;

  update public.savings_goals goal
  set
    current_usd = goal.current_usd + new.amount_usd,
    last_contribution_month = case
      when new.source = 'planned' then v_month
      else goal.last_contribution_month
    end,
    skipped_month = case
      when new.source = 'planned' then null
      else goal.skipped_month
    end,
    updated_at = clock_timestamp()
  where goal.id = new.goal_id
    and goal.user_id = v_user_id;

  if not found then
    raise exception 'Savings goal not found';
  end if;

  return new;
end;
$$;

revoke all on function public.apply_savings_contribution_ledger_entry()
  from public, anon, authenticated, service_role;

drop trigger if exists apply_savings_contribution_ledger_entry
  on public.savings_contributions;
create trigger apply_savings_contribution_ledger_entry
  after insert on public.savings_contributions
  for each row
  execute function public.apply_savings_contribution_ledger_entry();

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
security invoker
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

  select goal.current_usd, goal.target_usd
  into v_new_total, v_target
  from public.savings_goals goal
  where goal.id = p_goal_id
    and goal.user_id = v_user_id;

  if not found then
    raise exception 'Savings goal not found';
  end if;

  return query select
    v_new_total,
    coalesce(v_inserted_amount, 0::numeric),
    v_new_total >= v_target,
    v_inserted_amount is not null;
end;
$$;

comment on function public.apply_savings_contribution_ledger_entry() is
  'Keeps the immutable savings ledger and goal balance atomic. Not directly executable by API roles.';
