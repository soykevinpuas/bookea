"use client";

import { useQuery } from "@tanstack/react-query";
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
  return useQuery({
    queryKey: ["userBooks", userId, options?.search, options?.category],
    queryFn: () => getUserBooks(supabase, userId!, options),
    // Habilitado si hay usuario O si estamos offline (para ver lo que hay en caché)
    enabled: !!userId || (typeof window !== 'undefined' && !navigator.onLine),
    ...BOOK_QUERY_OPTIONS,
  });
}

