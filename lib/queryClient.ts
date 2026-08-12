import type { QueryClient } from '@tanstack/react-query'

// Set by QueryProvider once mounted (client-only, so never during SSR). Lets
// the existing invalidateXCache() helpers reach the same query cache without
// turning every one of their call sites into a hook.
let client: QueryClient | null = null

export function setQueryClient(qc: QueryClient) {
  client = qc
}

export function getQueryClient(): QueryClient | null {
  return client
}
