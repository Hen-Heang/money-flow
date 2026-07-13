-- exchange_rates upsert (base_currency, target_currency) has never had a matching
-- unique constraint, so ON CONFLICT in app/api/exchange-rate/route.ts and the AI
-- chat's getExchangeRate tool always failed with 42P10 and the rate was never
-- cached — every request re-hit the external API and callers silently fell back
-- to the stale FALLBACK_EXCHANGE_RATE constant.
alter table public.exchange_rates
  add constraint exchange_rates_currency_pair_unique unique (base_currency, target_currency);
