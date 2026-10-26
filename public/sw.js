const CACHE_NAME = 'yosseling-offline-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/manifest.webmanifest',
  '/yosseling-bg.png',
  '/assets/images/yosseling-icon-192.png',
  '/assets/images/yosseling-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('yosseling-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          const appShell = await caches.match('/');
          return appShell ?? new Response('Yosseling está sin conexión. Vuelve a conectarte e inténtalo de nuevo.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }),
    );
    return;
  }

  const isStaticAsset = url.pathname.startsWith('/_next/static/')
    || /\.(?:css|js|json|webmanifest|png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);
  if (!isStaticAsset) {
    event.respondWith(
      fetch(request).catch(() => new Response('Este recurso requiere conexión a internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const fallback = await caches.match('/');
        return fallback ?? new Response('Recurso no disponible sin conexión.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      });
    }),
  );
});
