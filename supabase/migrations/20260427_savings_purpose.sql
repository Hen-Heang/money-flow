ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS purpose text;
