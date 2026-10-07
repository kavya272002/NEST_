/* ═══════════════════════════════════════════════════
   NEST — Service Worker
   Enables offline caching & PWA installation.
   "All-in-One Household Locker, always in your pocket."
   ═══════════════════════════════════════════════════ */

const CACHE_NAME = 'nest-locker-v1';
const OFFLINE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './db.js',
    './translations.js',
    './sync.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    'https://unpkg.com/dexie@3.2.7/dist/dexie.min.js'
];

// ── INSTALL: Pre-cache core assets ──
self.addEventListener('install', (event) => {
    console.log('[NEST SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[NEST SW] Caching core assets');
            return cache.addAll(OFFLINE_ASSETS).catch(err => {
                console.warn('[NEST SW] Some assets failed to cache:', err);
                // Don't fail installation if external CDN assets fail
                return cache.addAll(OFFLINE_ASSETS.filter(u => !u.startsWith('http')));
            });
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// ── ACTIVATE: Clean old caches ──
self.addEventListener('activate', (event) => {
    console.log('[NEST SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[NEST SW] Removing old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    // Take control of all clients immediately
    self.clients.claim();
});

// ── FETCH: Cache-First for app shell, Network-First for others ──
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension and non-http requests
    if (!url.protocol.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached, but also update in background
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => { /* offline, no problem */ });

                return cachedResponse;
            }

            // Not in cache — try network
            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});

console.log('[NEST SW] Service Worker loaded');
