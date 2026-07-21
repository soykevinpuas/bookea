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
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
  retry: 1,
};

type BookFilters = { search?: string; category?: string; author?: string; adminId?: string };
type CatalogCachePayload = { cachedAt: number; data: Book[] };
type BookRealtimeRow = Partial<Book> & { id?: string };
type BookRealtimePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE";
  new?: BookRealtimeRow;
  old?: BookRealtimeRow;
};

const CATALOG_CACHE_PREFIX = "bookea-catalog-cache-v3";

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

function isBookRealtimePayload(payload: unknown): payload is BookRealtimePayload {
  return typeof payload === "object" && payload !== null && ("new" in payload || "old" in payload);
}

function isBookRow(row: BookRealtimeRow | undefined): row is BookRealtimeRow & { id: string } {
  return typeof row?.id === "string" && row.id.length > 0;
}

function bookMatchesQuery(book: Book, options?: BookFilters) {
  if (!book.is_active) return false;

  if (options?.adminId) {
    // El stock fisico admin depende de admin_stock; el refetch confirmado calcula esa vista.
    if (!book.epub_url) return false;
  } else if (!book.epub_url && book.stock_physical <= 0) {
    return false;
  }

  return applyBookFilters([book], options).length > 0;
}

function sortBooksByCreatedAt(books: Book[]) {
  return [...books].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Aplica el row de Realtime en memoria para que el catalogo cliente cambie antes del refetch.
function applyBookRealtimeRow(data: Book[] | undefined, payload: unknown, options?: BookFilters) {
  if (!data || !isBookRealtimePayload(payload)) return data;

  const row = isBookRow(payload.new) ? payload.new : payload.old;
  if (!isBookRow(row)) return data;

  if (payload.eventType === "DELETE") {
    return data.filter((book) => book.id !== row.id);
  }

  const existing = data.find((book) => book.id === row.id);
  const nextBook = { ...(existing ?? {}), ...row } as Book;

  if (!bookMatchesQuery(nextBook, options)) {
    return data.filter((book) => book.id !== row.id);
  }

  const found = data.some((book) => book.id === row.id);
  const next = found
    ? data.map((book) => book.id === row.id ? nextBook : book)
    : [nextBook, ...data];

  return sortBooksByCreatedAt(next);
}

// Hook de catalogo general con persistencia local y filtros.
export function useBooks(options?: BookFilters) {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const cacheKey = getCatalogCacheKey(options?.adminId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const noCategoryFilter = !options?.category || options?.category === 'all';
  const realtimeOptions = useMemo<BookFilters>(() => ({
    search: options?.search,
    category: options?.category,
    author: options?.author,
    adminId: options?.adminId,
  }), [options?.search, options?.category, options?.author, options?.adminId]);
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
    const refreshCatalog = (payload?: unknown) => {
      if (refreshTimer) clearTimeout(refreshTimer);

      if (!realtimeOptions.adminId && payload) {
        queryClient.setQueryData<Book[]>(
          ["books", realtimeOptions.search, realtimeOptions.category, realtimeOptions.author, realtimeOptions.adminId],
          (old) => applyBookRealtimeRow(old, payload, realtimeOptions)
        );

        if (!realtimeOptions.search && noCategoryFilter && !realtimeOptions.author) {
          const cached = parseCatalogCache(readCatalogCacheRaw(cacheKey));
          if (cached) writeCatalogCache(cacheKey, applyBookRealtimeRow(cached.data, payload, realtimeOptions) ?? cached.data);
        }
      }

      refreshTimer = setTimeout(() => {
        void queryClient.refetchQueries({ queryKey: ["books"], type: "active" });
        void queryClient.refetchQueries({ queryKey: ["book"], type: "active" });
      }, 120);
    };

    let channel = supabase
      .channel(`catalog-stock-${realtimeOptions.adminId || "public"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, refreshCatalog);

    if (realtimeOptions.adminId) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_stock", filter: `admin_id=eq.${realtimeOptions.adminId}` },
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
  }, [cacheKey, noCategoryFilter, queryClient, realtimeOptions, supabase]);

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
    initialData: () => queryClient.getQueriesData<Book[]>({ queryKey: ["books"] })
      .flatMap(([, books]) => books ?? [])
      .find((book) => book.id === id),
    initialDataUpdatedAt: 0,
    placeholderData: (previousData) => previousData,
    ...BOOK_QUERY_OPTIONS,
  });

  useEffect(() => {
    if (!id || channelRef.current) return;

    const applyBookChange = (payload: unknown) => {
      if (isBookRealtimePayload(payload) && isBookRow(payload.new)) {
        queryClient.setQueryData<Book | null>(["book", id], (old) => {
          if (payload.new?.id !== id) return old;
          return { ...(old ?? {}), ...payload.new } as Book;
        });
      }

      void queryClient.refetchQueries({ queryKey: ["book", id], type: "active" });
      void queryClient.refetchQueries({ queryKey: ["books"], type: "active" });
    };

    const channel = supabase
      .channel(`book-stock-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "books", filter: `id=eq.${id}` },
        applyBookChange
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

  return query;
}
