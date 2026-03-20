-- Add auto monthly deposit fields to savings_goals
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS auto_monthly_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_month  TEXT; -- format: 'YYYY-MM'
