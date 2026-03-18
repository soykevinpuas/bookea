"use client";

import { useQuery } from "@tanstack/react-query";
import { getBooks, getBook, getUserBooks } from "@/lib/books";

export function useBooks() {
  return useQuery({
    queryKey: ["books"],
    queryFn: getBooks,
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: ["book", id],
    queryFn: () => getBook(id),
    enabled: !!id,
  });
}

export function useUserBooks(userId: string) {
  return useQuery({
    queryKey: ["userBooks", userId],
    queryFn: () => getUserBooks(userId),
    enabled: !!userId,
  });
}
