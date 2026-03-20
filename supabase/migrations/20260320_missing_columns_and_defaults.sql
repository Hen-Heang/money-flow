-- ============================================================
-- Missing columns and default seed data
-- Covers all schema gaps from recent feature additions:
--   - Multi-currency (amount_usd, exchange_rate on transactions)
--   - Recurring transaction exchange rate
--   - Google OAuth user fields
--   - Default categories and payment methods for new users
-- ============================================================


-- ── 1. transactions ─────────────────────────────────────────

-- USD equivalent stored at time of transaction
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS amount_usd numeric NOT NULL DEFAULT 0;

-- Exchange rate snapshot used when the transaction was saved
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS exchange_rate numeric;


-- ── 2. recurring_transactions ───────────────────────────────

-- Exchange rate snapshot used when the rule was created
ALTER TABLE public.recurring_transactions
  ADD COLUMN IF NOT EXISTS exchange_rate numeric;


-- ── 3. users — Google OAuth fields ─────────────────────────
-- avatar_url was added in 20260311_users_profile_update.sql.
-- display_name should exist from initial schema.
-- This is a no-op safety check in case either is missing.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name  varchar(100),
  ADD COLUMN IF NOT EXISTS avatar_url    text;


-- ── 4. categories — type column ─────────────────────────────
-- Required for income/expense filtering and default seeding.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'expense'
    CHECK (type IN ('income', 'expense', 'both'));


-- ── 5. Default categories for new users ─────────────────────
-- These are inserted by app code (lib/profile.ts → seedDefaultUserData).
-- This function provides an equivalent SQL path for manual runs or
-- future triggers.

CREATE OR REPLACE FUNCTION public.seed_default_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip if user already has categories
  IF EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.categories (user_id, name, icon, color, type) VALUES
    -- Income
    (p_user_id, 'Salary',       '💼', '#10b981', 'income'),
    (p_user_id, 'Freelance',    '💻', '#3b82f6', 'income'),
    (p_user_id, 'Investment',   '📈', '#f59e0b', 'income'),
    (p_user_id, 'Other Income', '💰', '#8b5cf6', 'income'),
    -- Expense
    (p_user_id, 'Food & Dining',  '🍔', '#ef4444', 'expense'),
    (p_user_id, 'Transport',      '🚗', '#f59e0b', 'expense'),
    (p_user_id, 'Shopping',       '🛍️', '#ec4899', 'expense'),
    (p_user_id, 'Entertainment',  '🎮', '#8b5cf6', 'expense'),
    (p_user_id, 'Health',         '💊', '#06b6d4', 'expense'),
    (p_user_id, 'Housing',        '🏠', '#3b82f6', 'expense'),
    (p_user_id, 'Education',      '📚', '#10b981', 'expense'),
    (p_user_id, 'Other',          '📦', '#94a3b8', 'expense');

  INSERT INTO public.payment_methods (user_id, name, icon) VALUES
    (p_user_id, 'Cash',          '💵'),
    (p_user_id, 'Credit Card',   '💳'),
    (p_user_id, 'Debit Card',    '🏦'),
    (p_user_id, 'Bank Transfer', '🏧');
END;
$$;


-- ── 6. Indexes for common query patterns ────────────────────

-- Transactions filtered by user + date (dashboard, analytics)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions (user_id, date DESC);

-- Transactions filtered by user + type (income/expense split)
CREATE INDEX IF NOT EXISTS idx_transactions_user_type
  ON public.transactions (user_id, type);

-- Categories filtered by user
CREATE INDEX IF NOT EXISTS idx_categories_user
  ON public.categories (user_id);

-- Payment methods filtered by user
CREATE INDEX IF NOT EXISTS idx_payment_methods_user
  ON public.payment_methods (user_id);

-- Budgets filtered by user
CREATE INDEX IF NOT EXISTS idx_budgets_user
  ON public.budgets (user_id);

-- Savings goals filtered by user
CREATE INDEX IF NOT EXISTS idx_savings_goals_user
  ON public.savings_goals (user_id);
