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
  // Identificar el tipo de asset para aplicar la estrategia correcta
  const { request } = event;
  const url = new URL(request.url);

  // IGNORAR esquemas no soportados (chrome-extension, edge-extension, etc)
  if (!url.protocol.startsWith('http')) return;

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
      }).catch(() => {
        // 8.2.3 - Manejo quirúrgico de fallos de red
        const url = new URL(request.url);
        const isRscRequest = request.headers.get('RSC') || url.searchParams.has('_rsc') || url.pathname.includes('/_next/data/');

        // Si es una petición de datos (RSC), devolver 503 para que el cliente Next.js maneje el estado offline adecuadamente
        if (isRscRequest) {
          return new Response(null, { status: 503, statusText: 'Service Unavailable' });
        }

        // Si es una navegación completa, intentar servir la versión cacheada o la shell offline
        if (request.mode === 'navigate') {
          return caches.match(request).then((cached) =>
            cached || new Response(
              '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bookea Offline</title></head><body style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0"><div style="text-align:center;padding:20px"><h1 style="font-size:3rem;margin-bottom:10px">📚 Bookea</h1><h2 style="font-size:1.5rem;color:#3b82f6;margin-bottom:20px">Modo Offline</h2><p style="opacity:0.6;max-width:300px;margin:auto;line-height:1.5">No tienes conexión a internet y esta página no está guardada. Ve a tu <b>Dashboard</b> para ver tus libros descargados.</p><a href="/dashboard" style="display:inline-block;margin-top:30px;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:12px;font-weight:bold">Ir a mi Biblioteca</a></div></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
          );
        }
        
        return caches.match(request);
      })
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
