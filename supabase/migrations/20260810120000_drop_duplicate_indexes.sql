-- idx_categories_user and idx_categories_user_id are identical (btree on user_id);
-- idx_transactions_type and idx_transactions_user_type are identical (btree on user_id, type).
-- Duplicate indexes add write overhead with no read benefit. Keep the more descriptively named one of each pair.
DROP INDEX IF EXISTS public.idx_categories_user;
DROP INDEX IF EXISTS public.idx_transactions_type;
