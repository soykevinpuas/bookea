"use client";

import BookLongPressMenu from "@/components/BookLongPressMenu";

/**
 * 8.6 - CatalogBookCard: Wrapper de cliente para habilitar el menú long-press en el catálogo (Server Component)
 */
interface CatalogBookCardProps {
  bookId: string;
  bookTitle: string;
  epubUrl?: string | null;
  coverUrl?: string | null;
  children: React.ReactNode;
}

export default function CatalogBookCard({ bookId, bookTitle, epubUrl, coverUrl, children }: CatalogBookCardProps) {
  return (
    <BookLongPressMenu 
      bookId={bookId} 
      bookTitle={bookTitle} 
      epubUrl={epubUrl || undefined}
      coverUrl={coverUrl || undefined}
    >
      {children}
    </BookLongPressMenu>
  );
}
