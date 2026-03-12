-- Add currency field to transactions (default KRW for existing rows)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KRW';

-- Savings goals
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  icon        text        NOT NULL DEFAULT '💰',
  color       text        NOT NULL DEFAULT '#3b82f6',
  target_usd  numeric     NOT NULL DEFAULT 0,
  current_usd numeric     NOT NULL DEFAULT 0,
  deadline    date,
  note        text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own savings goals"
  ON public.savings_goals
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
