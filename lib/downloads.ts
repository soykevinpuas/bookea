// lib/downloads.ts - Gestión de caché de libros descargados para modo offline
import { Book } from "@/types/book";

export const BOOKS_CACHE = 'bookea-books-v3';
const METADATA_KEY = 'bookea-offline-metadata';

type CachedBook = Book & { cachedAt?: string; isOfflineReady?: boolean };

function readOfflineMetadata(): Record<string, CachedBook> {
  try {
    const existing = localStorage.getItem(METADATA_KEY);
    return existing ? JSON.parse(existing) : {};
  } catch {
    return {};
  }
}

/**
 * Guardar metadatos del libro para acceso offline
 */
export function saveBookMetadata(book: Book, isOfflineReady: boolean = false) {
  try {
    const metadata = readOfflineMetadata();

    // Si ya estaba marcado como offlineReady, no le quitemos la marca a menos que sea explícito
    const wasReady = metadata[book.id]?.isOfflineReady || false;

    metadata[book.id] = {
      ...book,
      isOfflineReady: isOfflineReady || wasReady,
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  } catch (err) {
    console.error("Error saving book metadata:", err);
  }
}

/**
 * Obtener metadatos de un libro específico desde el caché local
 */
export function getCachedBookMetadata(bookId: string): Book | null {
  try {
    const metadata = readOfflineMetadata();
    return metadata[bookId] || null;
  } catch {
    return null;
  }
}

/**
 * Obtener metadata solo de libros que el usuario descargó explícitamente.
 */
export function getOfflineReadyBookMetadata(bookId: string): Book | null {
  const metadata = getCachedBookMetadata(bookId) as CachedBook | null;
  return metadata?.isOfflineReady === true ? metadata : null;
}

/**
 * Obtener todos los libros descargados explícitamente para modo offline
 */
export function getAllCachedBooks(): Book[] {
  try {
    const metadata = readOfflineMetadata();
    return Object.values(metadata).filter((book) => book.isOfflineReady === true);
  } catch {
    return [];
  }
}

/**
 * Verificar si un libro está descargado en el caché local
 */
export async function isBookDownloaded(bookId: string, epubUrl?: string | null): Promise<boolean> {
  const metadata = getOfflineReadyBookMetadata(bookId) as CachedBook | null;
  if (!metadata) return false;

  const urlToMatch = epubUrl || metadata.epub_url;
  if (!urlToMatch) return false;

  try {
    const cache = await caches.open(BOOKS_CACHE);
    const response = await cache.match(urlToMatch);
    return !!response;
  } catch {
    return false;
  }
}

/**
 * Descargar libro al caché local para acceso offline (Incluyendo Portada y Metadata)
 */
export async function downloadBook(book: Book): Promise<boolean> {
  const { epub_url: epubUrl, cover_url: coverUrl } = book;
  if (!epubUrl) return false;

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

    // GUARDAR METADATA
    saveBookMetadata(book, true);

    // CACHEAR REVIEWS (Comunidad) para modo offline
    const { getBookReviews } = await import("./reviews");
    await getBookReviews(book.id);

    // CACHEAR INTERFAZ DEL LECTOR
    try {
      const readerUrl = `/reader/${book.id}`;
      const readerRes = await fetch(readerUrl);
      if (readerRes.ok) {
        await cache.put(readerUrl, readerRes);
      }
    } catch (e) {
      console.warn("No se pudo cachear la interfaz del lector:", e);
    }

    return true;
  } catch (err) {
    console.error("Error descargando recursos:", err);
    return false;
  }
}

/**
 * Eliminar libro del caché local
 */
export async function removeBookDownload(bookId: string, epubUrl: string): Promise<boolean> {
  try {
    // Eliminar archivos del Caché API
    const cache = await caches.open(BOOKS_CACHE);
    await cache.delete(epubUrl);

    // Eliminar metadatos del LocalStorage
    const existing = localStorage.getItem(METADATA_KEY);
    if (existing) {
      const metadata = JSON.parse(existing);
      delete metadata[bookId];
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Obtener tamaño aproximado del caché de libros
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

/**
 * Obtener el archivo (Blob) desde el caché local
 */
export async function getCachedBookFile(epubUrl: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(BOOKS_CACHE);
    const response = await cache.match(epubUrl);
    if (!response) return null;
    return await response.blob();
  } catch {
    return null;
  }
}
