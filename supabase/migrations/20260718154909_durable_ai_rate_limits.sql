create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to service_role;

create table private.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature ~ '^[a-z0-9][a-z0-9:_-]{0,63}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);

create index ai_rate_limits_updated_at_idx
  on private.ai_rate_limits (updated_at);

revoke all on table private.ai_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.ai_rate_limits to service_role;

create or replace function public.consume_ai_rate_limit(
  p_user_id uuid,
  p_feature text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_count integer;
  v_window_started_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if p_feature is null or p_feature !~ '^[a-z0-9][a-z0-9:_-]{0,63}$' then
    raise exception 'p_feature is invalid';
  end if;
  if p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'rate limit values must be positive';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into private.ai_rate_limits (
    user_id,
    feature,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_user_id, p_feature, v_now, 1, v_now)
  on conflict (user_id, feature) do update
  set
    request_count = case
      when private.ai_rate_limits.window_started_at <= v_now - v_window then 1
      else private.ai_rate_limits.request_count + 1
    end,
    window_started_at = case
      when private.ai_rate_limits.window_started_at <= v_now - v_window then v_now
      else private.ai_rate_limits.window_started_at
    end,
    updated_at = v_now
  returning request_count, window_started_at
  into v_count, v_window_started_at;

  return query
  select
    v_count <= p_max_requests,
    greatest(p_max_requests - v_count, 0),
    greatest(
      ceil(extract(epoch from (v_window_started_at + v_window - v_now)))::integer,
      0
    );
end;
$$;

revoke all on function public.consume_ai_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(uuid, text, integer, integer)
  to service_role;

comment on table private.ai_rate_limits is
  'Atomic, service-role-only counters for AI endpoint rate limiting.';
