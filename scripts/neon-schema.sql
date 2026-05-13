-- Money Flow - Neon Backup Schema
-- Run this once in the Neon SQL editor to create all tables.
-- No RLS, no auth.users references — plain Postgres.

-- Users
CREATE TABLE IF NOT EXISTS users (
  id               uuid        PRIMARY KEY,
  email            varchar     NOT NULL UNIQUE,
  display_name     varchar(100),
  avatar_url       text,
  default_currency varchar     NOT NULL DEFAULT 'KRW',
  created_at       timestamptz DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  name       varchar     NOT NULL,
  icon       varchar,
  color      varchar     DEFAULT '#10b981',
  type       varchar     DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'both')),
  created_at timestamptz DEFAULT now()
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES users(id) ON DELETE CASCADE,
  name       varchar     NOT NULL,
  icon       varchar,
  created_at timestamptz DEFAULT now()
);

-- Recurring transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              text        NOT NULL CHECK (type IN ('income', 'expense')),
  amount_krw        numeric     NOT NULL CHECK (amount_krw > 0),
  amount_usd        numeric     NOT NULL CHECK (amount_usd > 0),
  exchange_rate     numeric,
  currency          text        NOT NULL DEFAULT 'KRW' CHECK (currency IN ('KRW', 'USD')),
  description       text        NOT NULL,
  category_id       uuid        REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id uuid        REFERENCES payment_methods(id) ON DELETE SET NULL,
  note              text,
  frequency         text        NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_date         date        NOT NULL,
  last_applied      date,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        REFERENCES users(id) ON DELETE CASCADE,
  date              date        NOT NULL,
  type              varchar     NOT NULL CHECK (type IN ('income', 'expense')),
  category_id       uuid        REFERENCES categories(id) ON DELETE SET NULL,
  description       varchar,
  amount_krw        numeric     NOT NULL,
  amount_usd        numeric     NOT NULL DEFAULT 0,
  exchange_rate     numeric,
  payment_method_id uuid        REFERENCES payment_methods(id) ON DELETE SET NULL,
  note              text,
  currency          text        NOT NULL DEFAULT 'KRW',
  recurring_id      uuid        REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency   varchar     NOT NULL DEFAULT 'KRW',
  target_currency varchar     NOT NULL DEFAULT 'USD',
  rate            numeric     NOT NULL,
  fetched_at      timestamptz DEFAULT now()
);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount_krw  numeric     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, category_id)
);

-- Savings goals
CREATE TABLE IF NOT EXISTS savings_goals (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  icon             text        NOT NULL DEFAULT '💰',
  color            text        NOT NULL DEFAULT '#3b82f6',
  target_usd       numeric     NOT NULL DEFAULT 0,
  current_usd      numeric     NOT NULL DEFAULT 0,
  deadline         date,
  note             text,
  auto_monthly_usd numeric     NOT NULL DEFAULT 0,
  last_auto_month  text,
  purpose          text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Transaction templates
CREATE TABLE IF NOT EXISTS transaction_templates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              text        NOT NULL CHECK (type IN ('income', 'expense')),
  description       text        NOT NULL,
  amount_krw        numeric     NOT NULL CHECK (amount_krw > 0),
  currency          text        NOT NULL DEFAULT 'KRW',
  category_id       uuid        REFERENCES categories(id) ON DELETE SET NULL,
  payment_method_id uuid        REFERENCES payment_methods(id) ON DELETE SET NULL,
  note              text,
  created_at        timestamptz DEFAULT now()
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_date     ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type     ON transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_categories_user            ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user       ON payment_methods (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user               ON budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user         ON savings_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user    ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date        ON recurring_transactions (next_date) WHERE is_active = true;
