// Network-first service worker — always try the network, use cache only offline.
// This prevents stale JS/CSS from breaking the app after deploys.
const CACHE_NAME = 'socialforge-v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // Never intercept API calls
  if (event.request.url.includes('/api/')) return
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful static responses for offline fallback
        if (response.ok && !event.request.url.includes('/_next/static')) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})