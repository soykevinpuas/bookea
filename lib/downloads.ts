// lib/downloads.ts - Gestión de caché de libros descargados para modo offline

const BOOKS_CACHE = 'bookea-books';

/**
 * 8.1 - Verificar si un libro está descargado en el caché local
 */
export async function isBookDownloaded(epubUrl: string): Promise<boolean> {
  try {
    const cache = await caches.open(BOOKS_CACHE);
    const response = await cache.match(epubUrl);
    return !!response;
  } catch {
    return false;
  }
}

/**
 * 8.2 - Descargar libro al caché local para acceso offline (Incluyendo Portada)
 */
export async function downloadBook(epubUrl: string, coverUrl?: string): Promise<boolean> {
  try {
    const cache = await caches.open(BOOKS_CACHE);
    
    // Descargar EPUB
    const epubRes = await fetch(epubUrl);
    if (!epubRes.ok) return false;
    await cache.put(epubUrl, epubRes);

    // Descargar Portada (si existe)
    if (coverUrl) {
      const coverRes = await fetch(coverUrl);
      if (coverRes.ok) {
        await cache.put(coverUrl, coverRes);
      }
    }

    return true;
  } catch (err) {
    console.error("Error descargando recursos:", err);
    return false;
  }
}

/**
 * 8.3 - Eliminar libro del caché local
 */
export async function removeBookDownload(epubUrl: string): Promise<boolean> {
  try {
    const cache = await caches.open(BOOKS_CACHE);
    return await cache.delete(epubUrl);
  } catch {
    return false;
  }
}

/**
 * 8.4 - Obtener tamaño aproximado del caché de libros
 */
export async function getCacheSize(): Promise<string> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
      return `${usedMB} MB`;
    }
    return "Desconocido";
  } catch {
    return "Desconocido";
  }
}
