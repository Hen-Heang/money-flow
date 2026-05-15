-- Performance: cover both ORDER BY columns so Postgres doesn't need an extra sort pass.
-- The old index (user_id, date DESC) left created_at un-indexed, forcing a sort on every page fetch.
DROP INDEX IF EXISTS public.idx_transactions_user_date;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date_created
  ON public.transactions (user_id, date DESC, created_at DESC);

-- Trigram index so ilike '%search%' (leading wildcard) uses an index instead of a full scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_transactions_description_trgm
  ON public.transactions USING gin (description gin_trgm_ops);
