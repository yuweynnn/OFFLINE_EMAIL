
const CACHE_NAME = 'yuen-dispo-mail-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request);
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.some(asset => request.url.includes(asset) || request.url.endsWith(asset))) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Serving from cache:', request.url);
            return cachedResponse;
          }
          
          return fetch(request)
            .then((networkResponse) => {
              // Cache the fetched resource
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return networkResponse;
            });
        })
        .catch(() => {
          // Return cached version if available
          return caches.match(request);
        })
    );
    return;
  }

  // Handle API calls - cache successful responses
  if (url.protocol === 'https:' && (
    url.hostname.includes('1secmail.com') ||
    url.hostname.includes('guerrillamail.com') ||
    url.hostname.includes('harakirimail.com') ||
    url.hostname.includes('corsproxy.io') ||
    url.hostname.includes('allorigins.win')
  )) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses for a short time
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME + '-api')
              .then((cache) => {
                // Cache API responses for 5 minutes
                const headers = new Headers(responseClone.headers);
                headers.set('Cache-Control', 'max-age=300');
                const cachedResponse = new Response(responseClone.body, {
                  status: responseClone.status,
                  statusText: responseClone.statusText,
                  headers: headers
                });
                cache.put(request, cachedResponse);
              });
          }
          return response;
        })
        .catch(() => {
          // Try to serve from API cache if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // Default: try network first, fallback to cache
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle background sync for email checking
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-email-sync') {
    console.log('Background sync triggered');
    event.waitUntil(
      // Store sync request for when app is opened
      self.registration.showNotification('Yuen Dispo Mail', {
        body: 'Checking for new emails...',
        icon: '/manifest.json',
        badge: '/manifest.json',
        tag: 'email-check'
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
        // Open new window if no existing window
        return self.clients.openWindow('/');
      })
  );
});
