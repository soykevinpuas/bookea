// 1.1 - Service Worker para Bookea PWA (Offline-First)
// Versión 3: Compatible con Next.js + Vercel CDN
const CACHE_NAME = 'bookea-v3';
const BOOKS_CACHE = 'bookea-books';

// Solo cachear lo mínimo que sabemos que existe como archivo estático
const PRECACHE = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// 1.1.1 - Instalación: Precachear solo archivos estáticos seguros
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // No fallar si algún asset no existe
  );
  self.skipWaiting();
});

// 1.1.2 - Activación: Limpiar cachés viejos y tomar control inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== BOOKS_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// 1.2 - Interceptor de peticiones
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no sean GET
  if (request.method !== 'GET') return;

  // ─── ESTRATEGIA 1: EPUBs (Cache First) ───
  if (url.pathname.endsWith('.epub')) {
    event.respondWith(
      caches.open(BOOKS_CACHE).then((cache) =>
        cache.match(request).then((cached) =>
          cached || fetch(request).catch(() =>
            new Response('Libro no disponible offline', { status: 503 })
          )
        )
      )
    );
    return;
  }

  // ─── ESTRATEGIA 2: Supabase Storage (portadas, archivos) - Cache First con auto-cache ───
  if (url.hostname.includes('supabase') && url.pathname.includes('/storage/')) {
    event.respondWith(
      caches.open(BOOKS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  // ─── ESTRATEGIA 3: API calls a Supabase - NO interceptar ───
  if (url.hostname.includes('supabase')) {
    return; // Dejar que fallen naturalmente offline
  }

  // ─── ESTRATEGIA 4: Navegación (HTML pages) - Network First con fallback ───
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((res) => {
        // Cachear la página navegada para offline
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      }).catch(() =>
        // Intentar servir la versión cacheada de esta misma página
        caches.match(request).then((cached) =>
          cached || caches.match('/') || new Response(
            '<html><body style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1>📚 Bookea Offline</h1><p>Abre la app con internet al menos una vez para habilitar el modo offline.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        )
      )
    );
    return;
  }

  // ─── ESTRATEGIA 5: Assets de la app (JS, CSS, imágenes, fuentes) - Network First + Cache ───
  // NO filtrar por type === 'basic' porque Vercel CDN sirve assets como 'cors'
  event.respondWith(
    fetch(request).then((res) => {
      // Cachear TODOS los assets válidos (basic Y cors) excepto opaque
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(request).then((cached) =>
        cached || new Response('', { status: 404 })
      )
    )
  );
});
