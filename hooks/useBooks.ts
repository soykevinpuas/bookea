"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBooks, getBook, getUserBooks } from "@/lib/books";
import { createClientClient } from "@/lib/supabase";

const BOOK_QUERY_OPTIONS = {
  staleTime: 10 * 1000, // 10 segundos (para ser muy reactivo al volver del lector)
  gcTime: 30 * 60 * 1000, 
  retry: 1,
};

// 3.2 - useBooks: Hooks de React Query para la gestión del estado global del Catálogo y Libros de Usuario
export function useBooks() {
  const supabase = createClientClient();
  return useQuery({
    queryKey: ["books"],
    queryFn: () => getBooks(supabase),
    ...BOOK_QUERY_OPTIONS,
  });
}

export function useBook(id: string) {
  const supabase = createClientClient();
  return useQuery({
    queryKey: ["book", id],
    queryFn: () => getBook(supabase, id),
    enabled: !!id,
    ...BOOK_QUERY_OPTIONS,
  });
}

export function useUserBooks(userId: string, options?: { search?: string; category?: string }) {
  const supabase = createClientClient();
  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);

  const query = useQuery({
    queryKey: ["userBooks", userId, options?.search, options?.category],
    queryFn: async () => {
      const data = await getUserBooks(supabase, userId!, options);
      // Solo cacheamos la vista principal (sin filtros) para el inicio rápido
      if (data && !options?.search && !options?.category && typeof window !== 'undefined') {
        localStorage.setItem(`bookea-library-${userId}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (typeof window !== 'undefined' && userId && !options?.search && !options?.category) {
        const cached = localStorage.getItem(`bookea-library-${userId}`);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch (e) {
            return undefined;
          }
        }
      }
      return undefined;
    },
    // Habilitado si hay usuario O si estamos offline (para ver lo que hay en caché)
    enabled: !!userId || (typeof window !== 'undefined' && !navigator.onLine),
    ...BOOK_QUERY_OPTIONS,
  });

  // 3.2.1 - Sincronización Realtime para la biblioteca del usuario
  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) return;

    const channel = supabase
      .channel(`user-books-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'user_books',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // Invalidar todas las queries de libros del usuario
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

