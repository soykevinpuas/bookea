self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch for basic PWA installability.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(
        'Estás fuera de línea. Por favor, conéctate a internet para acceder a Bookea.',
        {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }
      );
    })
  );
});
