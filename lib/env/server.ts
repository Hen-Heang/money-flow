import 'server-only'

/**
 * Server-only environment variables. Importing this module from client code
 * fails the build (enforced by the `server-only` package), so a secret can
 * never accidentally end up in a browser bundle.
 *
 * These are intentionally optional (`string | undefined`) rather than
 * throwing on read: callers such as cron routes and the admin client decide
 * how to respond when a secret is missing (e.g. a specific 500 JSON body),
 * and that per-endpoint response shape must be preserved.
 */
export const serverEnv = {
  get supabaseServiceRoleKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET
  },
}
