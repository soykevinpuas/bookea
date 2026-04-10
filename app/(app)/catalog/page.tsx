import Link from "next/link";
import Image from "next/image";
import { getBooks } from "@/lib/books";
import Book3D from "@/components/Book3D";
import CatalogBookCard from "@/components/CatalogBookCard";
import { createClient } from "@/lib/server";
import { SearchFilters } from "@/components/SearchFilters";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    view?: "grid" | "list";
  }>;
}

// 3.1 - CatalogPage: Componente principal del catálogo que lista los libros disponibles
export default async function CatalogPage({ searchParams }: PageProps) {
  const { search, category, view = "list" } = await searchParams;
  
  // 3.1.1 - Inicialización del cliente Supabase en servidor y obtención de la colección filtrada
  const supabase = await createClient();
  const books = await getBooks(supabase, { search, category });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Catálogo de Libros
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Explora nuestra colección premium. {books.length} títulos encontrados.
            </p>
          </div>
        </div>

        <SearchFilters 
          initialSearch={search} 
          initialCategory={category} 
          initialView={view} 
        />

        {/* 3.1.2 - Renderizado condicional para estado vacío (Empty State) */}
        {books.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm">
            <span className="text-4xl block mb-4">🔍</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Sin resultados</h3>
            <p className="text-gray-500 dark:text-gray-400">No encontramos libros que coincidan con tu búsqueda.</p>
          </div>
        ) : (
          <div className={
            view === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8" 
              : "flex flex-col gap-4"
          }>
            {books.map((book) => (
              <CatalogBookCard key={book.id} bookId={book.id} bookTitle={book.title} epubUrl={book.epub_url}>
              <div
                className={`group bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl dark:shadow-none transition-all duration-300 overflow-hidden ${
                  view === "list" ? "flex flex-row min-h-0 h-32 sm:h-40" : "flex flex-col h-full hover:-translate-y-1"
                }`}
              >
                {/* Portada */}
                <div className={`${
                  view === "list" ? "w-20 sm:w-28 h-full shrink-0" : "relative aspect-[2/3]"
                } flex items-center justify-center bg-transparent overflow-hidden`}>
                   {book.cover_url ? (
                    <Link href={`/book/${book.id}`} className="w-full h-full">
                      <Book3D 
                        src={book.cover_url} 
                        title={book.title} 
                        className="w-full h-full"
                        objectFit={view === "list" ? "contain" : "cover"}
                      />
                    </Link>
                  ) : (
                    <Link href={`/book/${book.id}`} className="w-full h-full flex items-center justify-center text-xl text-gray-300 dark:text-white/10 bg-gray-50 dark:bg-white/5 font-serif italic rounded-xl border border-dashed border-white/20">
                      Bookea
                    </Link>
                  )}
                </div>

                {/* Información */}
                <div className={`p-3 sm:p-5 flex flex-col flex-1 min-w-0 ${view === "list" ? "justify-center" : ""}`}>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <Link href={`/book/${book.id}`} className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-lg line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {book.title}
                      </h3>
                    </Link>
                    {book.category && (
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-500/20 whitespace-nowrap shrink-0">
                        {book.category}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                    por {book.author}
                  </p>

                  {/* Descripción removida para limpieza visual en modo lista */}
                  
                  <div className={`flex items-center justify-between ${view === "list" ? "mt-1 sm:mt-4" : "mt-auto pt-4 border-t border-gray-100 dark:border-white/5"}`}>
                    <span className="text-sm sm:text-lg font-black">
                      {book.is_premium === false || book.price_digital === 0 ? (
                        <span className="text-green-600 dark:text-green-400">Gratis</span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">Premium</span>
                      )}
                    </span>
                    <Link
                      href={`/book/${book.id}`}
                      className="text-[10px] sm:text-sm font-medium bg-blue-600 dark:bg-blue-600/20 hover:bg-blue-700 dark:hover:bg-blue-600/30 text-white dark:text-blue-400 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl transition-all shadow-sm no-retro-override"
                      style={{ '--dot-bg': '#2563eb' } as any}
                    >
                      {view === "list" ? "Ver detalles" : "Detalles"}
                    </Link>
                  </div>
                </div>
              </div>
              </CatalogBookCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
