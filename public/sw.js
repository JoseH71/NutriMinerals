const CACHE_NAME = 'nutriminerals-cache-v10';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const isProxyRequest = event.request.url.includes('proxy') ||
        event.request.url.includes('intervals') ||
        event.request.url.includes('fetch') ||
        event.request.url.includes('googleapis');

    // Bypass cache for API/Proxy requests
    if (isProxyRequest) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }

    // Network First Strategy for other assets
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    return cachedResponse || (event.request.mode === 'navigate' ? caches.match('/index.html') : null);
                });
            })
    );
});
