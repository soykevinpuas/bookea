"use client";

import BookLongPressMenu from "@/components/BookLongPressMenu";

/**
 * CatalogBookCard: Wrapper de cliente para habilitar el menú long-press en el catálogo (Server Component)
 */
interface CatalogBookCardProps {
  book: import("@/types/book").Book;
  children: React.ReactNode;
}

export default function CatalogBookCard({ book, children }: CatalogBookCardProps) {
  return (
    /* El wrapper conserva el markup del catálogo y solo agrega interacción long-press. */
    <BookLongPressMenu book={book}>
      {children}
    </BookLongPressMenu>
  );
}
