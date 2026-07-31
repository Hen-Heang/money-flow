/**
 * Public environment variables — safe to read from browser bundles.
 * Values are validated lazily (on first read) rather than at module load,
 * so importing this module never crashes a build that doesn't invoke a
 * Supabase client during static generation.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in .env.local (see .env.example).`
    )
  }
  return value
}

export const clientEnv = {
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabaseAnonKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  },
}
