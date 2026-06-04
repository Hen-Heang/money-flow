-- Telegram account links
-- One row per user. Connects a Telegram chat to a Supabase user via a
-- short-lived one-time code generated in the app and redeemed by the bot.

create table if not exists telegram_accounts (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  chat_id              bigint,
  link_code            text,
  link_code_expires_at timestamptz,
  linked_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- A Telegram chat can only be linked to one user at a time.
create unique index if not exists telegram_accounts_chat_id_idx
  on telegram_accounts(chat_id)
  where chat_id is not null;

-- Fast lookup when the bot redeems a /link code.
create index if not exists telegram_accounts_link_code_idx
  on telegram_accounts(link_code)
  where link_code is not null;

-- RLS: users manage only their own link row. The bot webhook uses the
-- service role (bypasses RLS) since it has no user session.
alter table telegram_accounts enable row level security;

create policy "Users manage own telegram account"
  on telegram_accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Explicit grants (see 20260514_explicit_grants.sql).
grant select, insert, update, delete on public.telegram_accounts to authenticated;
grant select, insert, update, delete on public.telegram_accounts to service_role;

comment on table public.telegram_accounts is 'Links a Telegram chat to a Money Flow user for bot-based logging and alerts';
