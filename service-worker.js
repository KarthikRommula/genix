// service-worker.js

const CACHE_NAME = 'music-player-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/songs/optimized_pic.jpg',
  '/img/logo_black-192x192.png',
  '/img/logo_white-192x192.jpg'
];

// Install event - cache initial assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          console.log('📂 Serving from cache:', event.request.url);
          return response;
        }

        // Clone the request because it can only be used once
        const fetchRequest = event.request.clone();

        // Make network request and cache the response
        return fetch(fetchRequest)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response because it can only be used once
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('🌍 Fetched and cached:', event.request.url);
              });

            return response;
          })
          .catch((error) => {
            console.error('Network request failed:', error);
            // You could return a custom offline page here
            return new Response('Offline content here', {
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});