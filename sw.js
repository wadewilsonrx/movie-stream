const CACHE_NAME = 'streamiz-v1';
const ASSETS = [
    './',
    './index.html',
    './movies.html',
    './tvshows.html',
    './css/style.css',
    './js/app.js',
    './js/config.js',
    './js/api.js',
    './js/db.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // Cache first, fall back to network strategy for smooth load
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
