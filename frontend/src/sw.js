import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST || []);

// Cache basemap tiles (CARTO Voyager) for offline map viewing.
registerRoute(
  ({ url }) => /^[a-d]\.basemaps\.cartocdn\.com$/i.test(url.hostname),
  new CacheFirst({ cacheName: 'basemap-tiles', plugins: [new ExpirationPlugin({ maxEntries: 500 })] }),
);

self.skipWaiting();
self.clientsClaim();

// Web Push: show a notification and let a click focus/open the report.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* ignore malformed */ }
  const { title = 'GradFix', body = '', url = '/' } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'navigate', url: target });
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
