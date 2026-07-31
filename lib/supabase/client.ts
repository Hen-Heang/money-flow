import { createBrowserClient } from '@supabase/ssr'
import { clientEnv } from '@/lib/env/client'

// In-memory sequential lock that prevents concurrent token refresh races.
// navigator.locks caused AbortError in Safari/iOS when multiple tabs were open,
// but a plain noop lets multiple callers refresh the token simultaneously —
// the first rotation invalidates every other in-flight refresh token.
// This queue ensures only one refresh runs at a time without relying on navigator.locks.
const lockQueues = new Map<string, Promise<unknown>>()

const memoryLock = <R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const pending = (lockQueues.get(name) ?? Promise.resolve()) as Promise<unknown>
  const next = pending.then(() => fn())
  lockQueues.set(name, next.catch(() => {}))
  return next
}

const clientOptions = {
  auth: { lock: memoryLock },
}

// Singleton — one client per environment, created once on first call
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export const createClient = () => {
  if (typeof window === 'undefined') {
    return createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, clientOptions)
  }

  if (!browserClient) {
    browserClient = createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, clientOptions)
  }

  return browserClient
}
