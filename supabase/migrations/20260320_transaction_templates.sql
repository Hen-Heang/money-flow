-- User-saved transaction templates for quick re-use
CREATE TABLE IF NOT EXISTS public.transaction_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description       TEXT NOT NULL,
  amount_krw        NUMERIC NOT NULL CHECK (amount_krw > 0),
  currency          TEXT NOT NULL DEFAULT 'KRW',
  category_id       UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transaction_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON public.transaction_templates
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
