"use client";

import BookLongPressMenu from "@/components/BookLongPressMenu";

/**
 * 8.6 - CatalogBookCard: Wrapper de cliente para habilitar el menú long-press en el catálogo (Server Component)
 */
interface CatalogBookCardProps {
  book: import("@/types/book").Book;
  children: React.ReactNode;
}

export default function CatalogBookCard({ book, children }: CatalogBookCardProps) {
  return (
    <BookLongPressMenu book={book}>
      {children}
    </BookLongPressMenu>
  );
}
