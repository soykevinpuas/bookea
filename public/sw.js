// 1.1 - Service Worker para Bookea (Lectura Offline)
const CACHE_NAME = 'bookea-v2';
const BOOKS_CACHE = 'bookea-books';

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar cachés antiguos
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME && n !== BOOKS_CACHE).map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1.2 - Estrategia para archivos EPUB descargados (Cache First)
  // SOLO interceptar archivos .epub en storage de Supabase
  if (url.pathname.endsWith('.epub') || (url.hostname.includes('supabase') && url.pathname.includes('/storage/') && url.pathname.includes('/books/'))) {
    event.respondWith(
      caches.open(BOOKS_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).catch(() => {
            return new Response('Libro no disponible sin conexión', { status: 503 });
          });
        });
      })
    );
    return;
  }

  // 1.3 - Estrategia para imágenes/portadas de Supabase Storage (Cache First, luego Red)
  if (url.hostname.includes('supabase') && url.pathname.includes('/storage/')) {
    event.respondWith(
      caches.open(BOOKS_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((networkRes) => {
            // Auto-cachear portadas para offline
            if (networkRes.ok) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          }).catch(() => {
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // 1.4 - NO interceptar API calls a Supabase (REST/Auth) - dejar que fallen naturalmente
  if (url.hostname.includes('supabase') && !url.pathname.includes('/storage/')) {
    return; // No interceptar, dejar que el navegador maneje el error
  }

  // 1.5 - Estrategia para la app (Stale-while-revalidate con fallback offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/dashboard') || caches.match('/');
      })
    );
    return;
  }

  // 1.6 - Assets estáticos de la app (JS, CSS, fuentes) - Cache First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkRes) => {
        if (networkRes && networkRes.ok && networkRes.type === 'basic') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkRes;
      }).catch(() => {
        return new Response('', { status: 404 });
      });
    })
  );
});
