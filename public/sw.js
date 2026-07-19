// Service Worker de Bookea PWA: offline-first para EPUBs y fallback seguro para navegacion.
// Mantener CACHE_NAME/BOOKS_CACHE sincronizados con cambios de estrategia.
const CACHE_NAME = 'bookea-v5';
const BOOKS_CACHE = 'bookea-books-v3';
const LEGACY_APP_CACHES = ['bookea-v4'];
const LEGACY_BOOKS_CACHES = ['bookea-books', 'bookea-books-v2'];

const PRECACHE = [
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Precachea solo archivos estaticos seguros; no debe cachear manifest en previews con auth.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // No fallar si algún asset no existe
  );
  self.skipWaiting();
});

// Permite que la app active de inmediato una version nueva del SW al detectar update.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Migra EPUBs de caches legacy y limpia caches de app obsoletos.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const targetBooksCache = await caches.open(BOOKS_CACHE);

      await Promise.all(LEGACY_BOOKS_CACHES.map(async (legacyName) => {
        const legacyCache = await caches.open(legacyName);
        const requests = await legacyCache.keys();
        await Promise.all(requests.map(async (request) => {
          const response = await legacyCache.match(request);
          if (response) await targetBooksCache.put(request, response.clone());
        }));
        await caches.delete(legacyName);
      }));

      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== BOOKS_CACHE)
          .map((n) => caches.delete(n))
      );
      await Promise.all(LEGACY_APP_CACHES.map((name) => caches.delete(name)));

      await self.clients.claim();
    })()
  );
});

// Aplica estrategias por tipo de request para no interferir con Supabase ni RSC.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar esquemas no soportados (chrome-extension, edge-extension, etc).
  if (!url.protocol.startsWith('http')) return;

  // Ignorar peticiones que no sean GET.
  if (request.method !== 'GET') return;

  // EPUBs: Cache First porque son archivos grandes y necesarios offline.
  if (url.pathname.endsWith('.epub')) {
    event.respondWith(
      caches.open(BOOKS_CACHE).then((cache) =>
        cache.match(request).then((cached) =>
          cached || fetch(request).then((res) => {
            if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
              cache.put(request, res.clone());
            }
            return res;
          }).catch(() =>
            new Response('Libro no disponible offline', { status: 503 })
          )
        )
      )
    );
    return;
  }

  // Supabase Storage: Network First para refrescar portadas y conservar fallback.
  if (url.hostname.includes('supabase') && url.pathname.includes('/storage/')) {
    event.respondWith(
      caches.open(BOOKS_CACHE).then((cache) =>
        fetch(request).then((res) => {
          if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
            cache.put(request, res.clone());
          }
          return res;
        }).catch(() =>
          cache.match(request).then((cached) =>
            cached || new Response('', { status: 404 })
          )
        )
      )
    );
    return;
  }

  // API calls a Supabase: no interceptar para no ocultar errores de auth/datos.
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Next genera assets versionados en deploy; network-first evita servir bundle viejo en PWA instalada.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request).then((res) => {
          if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
            cache.put(request, res.clone());
          }
          return res;
        }).catch(() =>
          cache.match(request).then((cached) =>
            cached || new Response('', { status: 404 })
          )
        )
      )
    );
    return;
  }

  // Navegacion: Network First con HTML fallback; RSC devuelve 503 para que Next maneje offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        const url = new URL(request.url);
        const isRscRequest = request.headers.get('RSC') || url.searchParams.has('_rsc') || url.pathname.includes('/_next/data/');

        if (isRscRequest) {
          return new Response(null, { status: 503, statusText: 'Service Unavailable' });
        }

        // Solo el reader descargado explicitamente puede usar HTML cacheado.
        if (url.pathname.startsWith('/reader/')) {
          return caches.open(BOOKS_CACHE).then((cache) =>
            cache.match(request).then((cached) =>
              cached || new Response(
              '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bookea Offline</title></head><body style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0"><div style="text-align:center;padding:20px"><h1 style="font-size:3rem;margin-bottom:10px">📚 Bookea</h1><h2 style="font-size:1.5rem;color:#3b82f6;margin-bottom:20px">Modo Offline</h2><p style="opacity:0.6;max-width:300px;margin:auto;line-height:1.5">No tienes conexión a internet y esta página no está guardada. Ve a tu <b>Dashboard</b> para ver tus libros descargados.</p><a href="/dashboard" style="display:inline-block;margin-top:30px;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:12px;font-weight:bold">Ir a mi Biblioteca</a></div></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
            )
          );
        }

        return new Response(
          '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bookea Offline</title></head><body style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0"><div style="text-align:center;padding:20px"><h1 style="font-size:3rem;margin-bottom:10px">📚 Bookea</h1><h2 style="font-size:1.5rem;color:#3b82f6;margin-bottom:20px">Modo Offline</h2><p style="opacity:0.6;max-width:300px;margin:auto;line-height:1.5">No tienes conexión a internet. Abre tu biblioteca cuando vuelva la conexión o entra a un lector descargado previamente.</p><a href="/dashboard" style="display:inline-block;margin-top:30px;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:12px;font-weight:bold">Ir a mi Biblioteca</a></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Assets de app: Cache First con refresh en background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() => cached || new Response('', { status: 404 }));

      return cached || fetchPromise;
    })
  );
});
