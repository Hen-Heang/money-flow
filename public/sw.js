const CACHE_NAME = 'money-flow-v1'

// App shell: pre-cache these on install
const PRECACHE_URLS = [
  '/',
  '/transactions',
  '/savings',
  '/analytics',
  '/settings',
  '/icon.png',
  '/apple-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
]

// ── Install: pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting()
})

// ── Activate: delete outdated caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  )
  // Take control of all open tabs immediately
  self.clients.claim()
})

// ── Fetch: two strategies ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests from same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Skip Supabase and external API calls — always go to network
  if (url.hostname !== self.location.hostname) return

  // API routes: network-first → cache fallback
  // User sees cached data when offline instead of an error
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Everything else (pages, JS, CSS, images): stale-while-revalidate
  // Return cached immediately, update cache in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached) // network failed, fall back to stale cache

        // Return cached version immediately if available, else wait for network
        return cached || networkFetch
      })
    )
  )
})
