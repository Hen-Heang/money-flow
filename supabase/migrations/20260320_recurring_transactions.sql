-- Create Enum for recurrence frequency
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_frequency') THEN
        CREATE TYPE public.recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
    END IF;
END $$;

-- Create Recurring Transactions Table (Templates)
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id         uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    payment_method_id   uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    
    type                text NOT NULL CHECK (type IN ('income', 'expense')),
    amount_krw          numeric NOT NULL DEFAULT 0,
    amount_usd          numeric NOT NULL DEFAULT 0,
    currency            text NOT NULL DEFAULT 'KRW',
    description         text NOT NULL,
    note                text,
    
    frequency           public.recurrence_frequency NOT NULL DEFAULT 'monthly',
    interval_count      integer NOT NULL DEFAULT 1, -- e.g., every 2 months (interval_count = 2)
    
    start_date          date NOT NULL DEFAULT CURRENT_DATE,
    end_date            date,
    next_payment_date   date NOT NULL,
    
    status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Add reference to transactions to link them back to a recurring template
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users manage own recurring transactions"
    ON public.recurring_transactions
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Performance index for the upcoming scheduler
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON public.recurring_transactions(next_payment_date) WHERE status = 'active';

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for recurring_transactions
CREATE TRIGGER update_recurring_transactions_updated_at
    BEFORE UPDATE ON public.recurring_transactions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
