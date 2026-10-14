const CACHE_NAME = 'andradeagro-shell-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/andrade-agro-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache non-fatal pre-cache error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // CRITICAL: Never cache Vite dev server modules, hot reload, node_modules, or dev hostnames
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.includes('ais-dev-') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t') ||
    url.pathname.includes('hot-update')
  ) {
    return; // Pass through directly to network without caching
  }

  // Ignore Firebase, Firestore, external APIs, and WebSocket streams from SW cache
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.pathname.startsWith('/api/') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // For HTML navigation requests (opening the app) - Always Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // For static assets - Network First with Cache Fallback to avoid stale JS versions
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline resource not available', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

// ============================================================================
// PUSH NOTIFICATIONS (Firebase Cloud Messaging & Web Push)
// ============================================================================
self.addEventListener('push', (event) => {
  let payload = {
    title: '⚠️ Notificação AndradeAgro',
    body: 'Novo evento registrado no sistema.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const json = event.data.json();
      payload = { ...payload, ...json };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  // Extract from both standard Web Push and Firebase Cloud Messaging structure
  const notificationTitle = payload.title || (payload.notification && payload.notification.title) || '⚠️ Notificação AndradeAgro';
  const notificationBody = payload.body || (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || '';
  const targetUrl = (payload.data && payload.data.url) || payload.url || (payload.notification && payload.notification.click_action) || '/';

  const notificationOptions = {
    body: notificationBody,
    icon: payload.icon || (payload.notification && payload.notification.icon) || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    data: {
      url: targetUrl,
      ...(payload.data || {})
    },
    vibrate: [200, 100, 200],
    tag: payload.tag || (payload.data && payload.data.eventId) || ('andradeagro-event-' + Date.now()),
    renotify: true,
    requireInteraction: false
  };

  // Exibe a notificação do sistema operacional em foreground e background
  const notifyPromise = self.registration.showNotification(notificationTitle, notificationOptions).catch((err) => {
    console.warn('[SW] Rich notification failed, trying basic notification:', err);
    return self.registration.showNotification(notificationTitle, {
      body: notificationBody,
      icon: '/icon-192.png'
    });
  });

  // Notifica também abas/janelas do Andrade Agro que estejam abertas em primeiro plano
  const broadcastPromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({
        type: 'ANDRADEAGRO_PUSH_EVENT',
        title: notificationTitle,
        body: notificationBody,
        data: notificationOptions.data
      });
    }
  }).catch(() => {});

  event.waitUntil(Promise.all([notifyPromise, broadcastPromise]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and notify client to navigate
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            client.postMessage({
              type: 'ANDRADEAGRO_NOTIFICATION_CLICK',
              url: targetUrl,
              data: (event.notification.data) || {}
            });
          } catch (postErr) {
            console.warn('[SW] Could not postMessage to client:', postErr);
          }
          if ('navigate' in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

