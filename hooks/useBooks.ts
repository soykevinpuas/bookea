"use client";

import { useQuery } from "@tanstack/react-query";
import { getBooks, getBook, getUserBooks } from "@/lib/books";
import { createClientClient } from "@/lib/supabase";

// 3.2 - useBooks: Hooks de React Query para la gestión del estado global del Catálogo y Libros de Usuario
export function useBooks() {
  const supabase = createClientClient();
  return useQuery({
    queryKey: ["books"],
    queryFn: () => getBooks(supabase),
  });
}

export function useBook(id: string) {
  const supabase = createClientClient();
  return useQuery({
    queryKey: ["book", id],
    queryFn: () => getBook(supabase, id),
    enabled: !!id,
  });
}

export function useUserBooks(userId: string) {
  const supabase = createClientClient();
  return useQuery({
    queryKey: ["userBooks", userId],
    queryFn: () => getUserBooks(supabase, userId),
    enabled: !!userId,
  });
}

