// 1.1 - Configuración del Service Worker para Bookea (Lectura Offline)
const CACHE_NAME = 'bookea-v1';
const BOOKS_CACHE = 'bookea-books';

// Archivos básicos para que la app cargue sin internet (App Shell)
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1.2 - Estrategia para archivos EPUB (Cache First)
  // Si es un archivo de libro, intentamos servir desde el caché de libros primero
  if (url.pathname.endsWith('.epub') || url.hostname.includes('supabase')) {
    event.respondWith(
      caches.match(request, { cacheName: BOOKS_CACHE }).then((response) => {
        return response || fetch(request).then((fetchRes) => {
          // Si no está en caché pero hay red, podríamos cachearlo aquí opcionalmente
          // Por ahora dejamos que el usuario lo haga explícitamente desde la UI
          return fetchRes;
        });
      }).catch(() => {
        return new Response('Libro no disponible sin conexión', { status: 503 });
      })
    );
    return;
  }

  // 1.3 - Estrategia para el resto de la app (Stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((response) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Actualizamos el caché con la nueva respuesta si es válida
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red y no hay caché, devuelves el error amigable
        if (request.mode === 'navigate') {
          return caches.match('/dashboard') || caches.match('/');
        }
      });

      return response || fetchPromise;
    })
  );
});
