const CACHE_NAME = 'socialforge-v1'
const STATIC_ASSETS = ['/', '/login', '/compose', '/settings', '/analytics', '/calendar', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
      }
      return response
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
  )
})
