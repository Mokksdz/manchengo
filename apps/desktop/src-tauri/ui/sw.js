/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MANCHENGO SMART ERP — Service Worker
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PWA Service Worker with:
 * - Static asset caching (Cache First)
 * - API caching (Network First with cache fallback)
 * - Offline support
 * - Background sync for offline mutations
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `manchengo-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `manchengo-dynamic-${CACHE_VERSION}`;
const API_CACHE = `manchengo-api-${CACHE_VERSION}`;
const OFFLINE_SYNC_QUEUE = 'manchengo-offline-sync';

// Static assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/offline',
  '/manifest.json',
  '/logo_manchengo.svg',
];

// API routes to cache for offline access
const CACHEABLE_API_ROUTES = [
  '/api/dashboard/kpis',
  '/api/dashboard/alerts',
  '/api/products/mp',
  '/api/products/pf',
  '/api/suppliers',
  '/api/clients',
  '/api/recipes',
];

// API routes that should use network-only (sensitive/real-time)
const NETWORK_ONLY_ROUTES = [
  '/api/auth',
  '/api/sync',
  '/api/license',
];

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALL EVENT — Pre-cache static assets
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    })
  );

  // Activate immediately
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVATE EVENT — Clean old caches
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('manchengo-') &&
                   name !== STATIC_CACHE &&
                   name !== DYNAMIC_CACHE &&
                   name !== API_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  // Take control immediately
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH EVENT — Caching strategies
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (we'll handle POST/PUT/DELETE with background sync)
  if (request.method !== 'GET') {
    // For mutations, try network first, queue if offline
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      event.respondWith(handleMutation(request));
    }
    return;
  }

  // Skip chrome-extension, websocket, and external requests
  if (!url.origin.includes(self.location.origin) ||
      url.protocol === 'chrome-extension:' ||
      url.pathname.startsWith('/ws')) {
    return;
  }

  // API requests — Network First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Network-only routes (auth, sync)
    if (NETWORK_ONLY_ROUTES.some(route => url.pathname.startsWith(route))) {
      return;
    }

    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Static assets (.js, .css, images) — Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // HTML pages — Network First (for fresh content)
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// ═══════════════════════════════════════════════════════════════════════════════
// CACHING STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cache First — Good for static assets that rarely change
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached version, update cache in background
    refreshCache(request, cache);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache First failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First — Good for API and dynamic content
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline');
      if (offlinePage) return offlinePage;
    }

    // Return error for API requests
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Vous êtes hors ligne. Les données affichées peuvent être obsolètes.',
        cached: false
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Refresh cache in background (stale-while-revalidate pattern)
 */
async function refreshCache(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Ignore background refresh errors
  }
}

/**
 * Handle mutations (POST/PUT/DELETE) with offline queue
 */
async function handleMutation(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // If offline, queue the request for later
    console.log('[SW] Mutation failed, queueing for background sync:', request.url);

    await queueOfflineRequest(request);

    return new Response(
      JSON.stringify({
        queued: true,
        message: 'Votre action a été enregistrée et sera synchronisée automatiquement.',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC — Retry offline mutations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Queue a request for background sync
 */
async function queueOfflineRequest(request) {
  const db = await openIndexedDB();
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
  };

  await db.put('offline-requests', requestData);

  // Register for background sync if supported
  if ('sync' in self.registration) {
    await self.registration.sync.register(OFFLINE_SYNC_QUEUE);
  }
}

/**
 * Process offline queue when back online
 */
self.addEventListener('sync', (event) => {
  if (event.tag === OFFLINE_SYNC_QUEUE) {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  console.log('[SW] Processing offline queue...');

  const db = await openIndexedDB();
  const requests = await db.getAll('offline-requests');

  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body,
      });

      if (response.ok) {
        await db.delete('offline-requests', requestData.id);
        console.log('[SW] Synced offline request:', requestData.url);

        // Notify the client
        notifyClients({
          type: 'SYNC_SUCCESS',
          url: requestData.url,
        });
      }
    } catch (error) {
      console.warn('[SW] Failed to sync request, will retry:', requestData.url);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'manchengo-notification',
    data: data.data || {},
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Manchengo ERP', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if possible
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(targetUrl);
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(pathname) ||
         pathname.startsWith('/_next/static/');
}

function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

/**
 * Simple IndexedDB wrapper for offline queue
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('manchengo-sw', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-requests')) {
        db.createObjectStore('offline-requests', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      resolve({
        put: (store, data) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).put(data);
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        }),
        getAll: (store) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        }),
        delete: (store, key) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).delete(key);
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
      });
    };
  });
}

console.log('[SW] Service Worker loaded successfully');
