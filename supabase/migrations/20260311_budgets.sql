-- Monthly budgets per category
CREATE TABLE IF NOT EXISTS public.budgets (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid        NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_krw  numeric     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, category_id)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budgets"
  ON public.budgets
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
