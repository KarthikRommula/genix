// service-worker.js
const CACHE_VERSION = '2';
const CACHE_NAME = `music-player-cache-v${CACHE_VERSION}`;

// Assets to cache on install
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
  console.log(`Installing service worker v${CACHE_VERSION}`);
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened, adding assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log(`Activating service worker v${CACHE_VERSION}`);
  
  // Take control of all clients immediately
  event.waitUntil(
    Promise.all([
      // Clean up old caches
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
        }),
      // Take control of uncontrolled clients
      self.clients.claim()
    ])
  );
});

// Fetch event - stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }
  
  // Skip database requests
  if (event.request.url.includes('indexeddb') || 
      event.request.destination === 'object' ||
      event.request.url.includes('chrome-extension')) {
    return;
  }

  // Stale-while-revalidate strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Clone the request because it can only be used once
        const fetchPromise = fetch(event.request.clone())
          .then((networkResponse) => {
            // Check if we received a valid response
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              // Clone the response because it can only be used once
              const responseToCache = networkResponse.clone();
              
              // Update the cache asynchronously
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                  console.log('🔄 Updated cache for:', event.request.url);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('⚠️ Fetch failed, falling back to cache:', error);
            // Return null so we fall back to cached version
            return null;
          });

        // Return cached response immediately if available, or wait for network
        return cachedResponse || fetchPromise.then(response => {
          // If both cache and network fail, return offline page
          if (!response) {
            console.log('🔴 No cache or network response available');
            return caches.match('/offline.html')
              .then(offlineResponse => {
                return offlineResponse || new Response(
                  'You are offline and no cached content is available.',
                  { headers: { 'Content-Type': 'text/plain' } }
                );
              });
          }
          return response;
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION
    });
  }
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-playlists') {
    event.waitUntil(syncPlaylists());
  }
});

// Function to handle background sync
async function syncPlaylists() {
  // Implementation for syncing playlists when online
  console.log('Synchronizing playlists in the background');
  
  // Get stored sync data from IndexedDB
  // Process and send to server
  // Update local data with server response
  
  return true; // Success
}

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body || 'New content is available!',
    icon: '/img/logo_black-192x192.png',
    badge: '/img/logo_white-192x192.jpg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Music Player Update',
      options
    )
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // If a window client is already open, focus it
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});