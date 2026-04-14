// lib/downloads.ts - Gestión de caché de libros descargados para modo offline
import { Book } from "@/types/book";

const BOOKS_CACHE = 'bookea-books';
const METADATA_KEY = 'bookea-offline-metadata';

/** 
 * 8.0 - Guardar metadatos del libro para acceso offline
 */
export function saveBookMetadata(book: Book, isOfflineReady: boolean = false) {
  try {
    const existing = localStorage.getItem(METADATA_KEY);
    const metadata = existing ? JSON.parse(existing) : {};
    
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
 * 8.0.1 - Obtener metadatos de un libro específico desde el caché local
 */
export function getCachedBookMetadata(bookId: string): Book | null {
  try {
    const existing = localStorage.getItem(METADATA_KEY);
    if (!existing) return null;
    const metadata = JSON.parse(existing);
    return metadata[bookId] || null;
  } catch {
    return null;
  }
}

/**
 * 8.0.2 - Obtener todos los libros guardados offline
 */
export function getAllCachedBooks(): Book[] {
  try {
    const existing = localStorage.getItem(METADATA_KEY);
    if (!existing) return [];
    const metadata = JSON.parse(existing);
    return Object.values(metadata);
  } catch {
    return [];
  }
}

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
 * 8.2 - Descargar libro al caché local para acceso offline (Incluyendo Portada y Metadata)
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

    return true;
  } catch (err) {
    console.error("Error descargando recursos:", err);
    return false;
  }
}

/**
 * 8.3 - Eliminar libro del caché local
 */
export async function removeBookDownload(bookId: string, epubUrl: string): Promise<boolean> {
  try {
    // 1. Eliminar archivos del Caché API
    const cache = await caches.open(BOOKS_CACHE);
    await cache.delete(epubUrl);

    // 2. Eliminar metadatos del LocalStorage
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

/**
 * 8.5 - Obtener el archivo (Blob) desde el caché local
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
