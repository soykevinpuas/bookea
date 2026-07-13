"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBooks, getBook, getUserBooks } from "@/lib/books";
import { createClientClient } from "@/lib/supabase";
import type { Book } from "@/types/book";
import type { RealtimeChannel } from "@supabase/supabase-js";

const BOOK_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 1,
};

type BookFilters = { search?: string; category?: string; author?: string; adminId?: string };
type CatalogCachePayload = { cachedAt: number; data: Book[] };

const CATALOG_CACHE_PREFIX = "bookea-catalog-cache-v2";

// Cache por admin/publico para que catalogo cargue rapido y respete stock propio.
function getCatalogCacheKey(adminId?: string) {
  return `${CATALOG_CACHE_PREFIX}-${adminId || "public"}`;
}

// Lee cache local sin romper SSR ni modo privado del navegador.
function readCatalogCacheRaw(cacheKey: string) {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(cacheKey);
  } catch {
    return null;
  }
}

// Acepta formato legacy (array) y formato nuevo con timestamp.
function parseCatalogCache(cached: string | null): CatalogCachePayload | null {
  try {
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Book[] | CatalogCachePayload;
    if (Array.isArray(parsed)) return { cachedAt: 0, data: parsed };
    if (Array.isArray(parsed.data)) return parsed;
  } catch {}

  return null;
}

// Escribe cache y notifica a otros hooks en la misma pestaña.
function writeCatalogCache(cacheKey: string, data: Book[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
    window.dispatchEvent(new Event("bookea-catalog-cache"));
  } catch {}
}

// Limpia cache persistida cuando Realtime avisa que stock/catalogo cambio.
function clearCatalogCache(cacheKey: string) {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(cacheKey);
    window.dispatchEvent(new Event("bookea-catalog-cache"));
  } catch {}
}

// useSyncExternalStore necesita una suscripcion estable a localStorage/evento custom.
function subscribeCatalogCache(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("bookea-catalog-cache", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("bookea-catalog-cache", onStoreChange);
  };
}

// Reaplica filtros client-side sobre placeholderData cacheada.
function applyBookFilters(data: Book[], options?: BookFilters) {
  let filtered = data;
  if (options?.search) {
    const search = options.search.toLowerCase();
    filtered = filtered.filter((book) =>
      book.title?.toLowerCase().includes(search) || book.author?.toLowerCase().includes(search)
    );
  }
  if (options?.author) {
    const author = options.author.toLowerCase();
    filtered = filtered.filter((book) => book.author?.toLowerCase().includes(author));
  }
  if (options?.category && options.category !== "all") {
    filtered = filtered.filter((book) => book.category === options.category);
  }
  return filtered;
}

// Hook de catalogo general con persistencia local y filtros.
export function useBooks(options?: BookFilters) {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const cacheKey = getCatalogCacheKey(options?.adminId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const noCategoryFilter = !options?.category || options?.category === 'all';
  const cachedCatalogRaw = useSyncExternalStore(
    subscribeCatalogCache,
    () => readCatalogCacheRaw(cacheKey),
    () => null
  );
  const cachedCatalog = useMemo(
    () => parseCatalogCache(cachedCatalogRaw),
    [cachedCatalogRaw]
  );

  const query = useQuery<Book[]>({
    queryKey: ["books", options?.search, options?.category, options?.author, options?.adminId],
    queryFn: async () => {
      const data = await getBooks(supabase, options);
      if (data && !options?.search && noCategoryFilter && !options?.author && typeof window !== 'undefined') {
        writeCatalogCache(cacheKey, data);
      }
      return data;
    },
    placeholderData: () => {
      if (!cachedCatalog) return undefined;
      return applyBookFilters(cachedCatalog.data, options);
    },
    ...BOOK_QUERY_OPTIONS,
  });

  useEffect(() => {
    if (channelRef.current) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshCatalog = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        clearCatalogCache(cacheKey);
        queryClient.invalidateQueries({ queryKey: ["books"] });
        queryClient.invalidateQueries({ queryKey: ["book"] });
      }, 120);
    };

    let channel = supabase
      .channel(`catalog-stock-${options?.adminId || "public"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, refreshCatalog);

    if (options?.adminId) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_stock", filter: `admin_id=eq.${options.adminId}` },
        refreshCatalog
      );
    }

    channel = channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [cacheKey, options?.adminId, queryClient, supabase]);

  return query;
}

// Hook de detalle de libro por UUID.
export function useBook(id: string) {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const query = useQuery<Book | null>({
    queryKey: ["book", id],
    queryFn: () => getBook(supabase, id),
    enabled: !!id,
    ...BOOK_QUERY_OPTIONS,
  });

  useEffect(() => {
    if (!id || channelRef.current) return;

    const channel = supabase
      .channel(`book-stock-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "books", filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["book", id] });
          queryClient.invalidateQueries({ queryKey: ["books"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [id, queryClient, supabase]);

  return query;
}

// Hook de biblioteca del usuario con cache local y realtime sobre user_books.
export function useUserBooks(userId: string, options?: { search?: string; category?: string }) {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const query = useQuery<Book[]>({
    queryKey: ["userBooks", userId, options?.search, options?.category],
    queryFn: async () => {
      const data = await getUserBooks(supabase, userId!, options);
      // Solo cacheamos la vista principal sin filtros para arranque rapido.
      if (data && !options?.search && !options?.category && typeof window !== 'undefined') {
        localStorage.setItem(`bookea-library-${userId}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: (): Book[] | undefined => {
      if (typeof window !== 'undefined' && userId && !options?.search && !options?.category) {
        const cached = localStorage.getItem(`bookea-library-${userId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            return Array.isArray(parsed) ? (parsed as Book[]) : undefined;
          } catch {
            return undefined;
          }
        }
      }
      return undefined;
    },
    // Offline sin userId aun puede mostrar cache de biblioteca local.
    enabled: !!userId || (typeof window !== 'undefined' && !navigator.onLine),
    ...BOOK_QUERY_OPTIONS,
  });

  // Realtime invalida biblioteca cuando Stripe/admin/canjes modifican user_books.
  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) return;

    const channel = supabase
      .channel(`user-books-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_books',
          filter: `user_id=eq.${userId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["userBooks", userId] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, queryClient, supabase]);

  return query;
}
