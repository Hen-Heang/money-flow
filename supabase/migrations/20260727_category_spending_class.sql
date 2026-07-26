-- Lets the user classify each category so budget recommendations know what
-- is safe to trim. Deliberately nullable with NO default: an unclassified
-- category is never auto-trimmed, so family support or education can't be
-- treated as discretionary spending by default.

alter table public.categories
  add column if not exists spending_class text
    check (spending_class is null or spending_class in ('essential', 'commitment', 'growth', 'flexible', 'avoidable'));

comment on column public.categories.spending_class is
  'User-assigned budget class. NULL means unclassified — recommendations never reduce these automatically.';
