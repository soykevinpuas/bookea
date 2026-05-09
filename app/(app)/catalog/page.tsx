"use client";

import { useBooks } from "@/hooks/useBooks";
import Book3D from "@/components/Book3D";
import CatalogBookCard from "@/components/CatalogBookCard";
import { SearchFilters } from "@/components/SearchFilters";
import { useSearchParams, useRouter } from "next/navigation";
import { CatalogSkeleton, PrefetchLink } from "@/components/ui/LoadingStates";
import { useMemo, useState, Suspense, useCallback } from "react";
import { Book } from "@/types/book";
import { useCartStore } from "@/stores/cart";
import { ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";

// 3.1 - CatalogContent: Lógica interna del catálogo con React Query para velocidad SPA
function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem } = useCartStore();
  const [adding, setAdding] = useState<string | null>(null);
  
  const search = searchParams.get("search") || "";
  const author = searchParams.get("author") || "";
  const category = searchParams.get("category") || "all";
  const view = (searchParams.get("view") as "grid" | "list" | "compact") || "list";
  const tab = searchParams.get("tab") || "todos";

  // 3.1.1 - Obtención de libros vía React Query (Instantáneo si está cacheado)
  const { data: booksData, isLoading } = useBooks({ search, author, category });

  // 3.1.2 - Aplicar barajado (shuffle) solo si no hay filtros activos para rotación de contenido
  const books = useMemo<Book[]>(() => {
    if (!booksData) return [];
    let filtered = [...booksData];

    // Filtro por pestaña
    if (tab === 'digitales') {
      filtered = filtered.filter((b) => b.price_digital > 0 || b.price_digital === null);
    } else if (tab === 'fisicos') {
      filtered = filtered.filter((b) => b.price_physical > 0 && b.stock_physical > 0);
    }

    const shouldShuffle = !search && !author && (category === 'all' || !category);
    if (shouldShuffle) {
      return filtered.sort(() => Math.random() - 0.5);
    }
    return filtered;
  }, [booksData, search, author, category, tab]);

  const setTab = useCallback((t: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.push(`/catalog?${params.toString()}`)
  }, [searchParams, router])

  const handleAddToCart = async (book: Book, type: 'digital' | 'physical') => {
    const key = `${book.id}-${type}`
    setAdding(key)
    try {
      await addItem(book.id, type)
      toast.success(`${book.title} agregado (${type === 'digital' ? 'Digital' : 'Físico'})`, {
        action: { label: 'Ver carrito', onClick: () => useCartStore.getState().setOpen(true) },
      })
    } catch {
      toast.error('Error al agregar al carrito')
    } finally {
      setAdding(null)
    }
  }

  if (isLoading && books.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <CatalogSkeleton variant={view} />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Catálogo de Libros
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Explora nuestra colección premium. {books.length} títulos encontrados.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl w-fit">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'digitales', label: 'Digitales' },
              { key: 'fisicos', label: 'Físicos' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  tab === t.key
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <SearchFilters 
          initialSearch={search} 
          initialAuthor={author}
          initialCategory={category} 
          initialView={view} 
        />

        {/* 3.1.3 - Lista de libros con diferentes modos de vista */}
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
              : view === "compact"
              ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              : "flex flex-col gap-4"
          }>
            {books.map((book: Book) => (
              view === "compact" ? (
                <CatalogBookCard key={book.id} book={book}>
                  <PrefetchLink href={`/book/${book.id}`} bookId={book.id} className="group block">
                    <div className="aspect-[2/3] relative rounded-2xl overflow-hidden shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300">
                      <Book3D src={book.cover_url || ""} title={book.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                         <h4 className="text-white text-xs font-bold truncate">{book.title}</h4>
                      </div>
                    </div>
                  </PrefetchLink>
                </CatalogBookCard>
              ) : (
              <CatalogBookCard 
                key={book.id} 
                book={book}
              >
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
                    <PrefetchLink href={`/book/${book.id}`} bookId={book.id} className="w-full h-full">
                      <Book3D 
                        src={book.cover_url} 
                        title={book.title} 
                        className="w-full h-full"
                        objectFit={view === "list" ? "contain" : "cover"}
                      />
                    </PrefetchLink>
                  ) : (
                    <PrefetchLink href={`/book/${book.id}`} bookId={book.id} className="w-full h-full flex items-center justify-center text-xl text-gray-300 dark:text-white/10 bg-gray-50 dark:bg-white/5 font-serif italic rounded-xl border border-dashed border-white/20">
                      Bookea
                    </PrefetchLink>
                  )}
                </div>

                {/* Información */}
                <div className={`p-3 sm:p-5 flex flex-col flex-1 min-w-0 ${view === "list" ? "justify-center" : ""}`}>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <PrefetchLink href={`/book/${book.id}`} bookId={book.id} className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-lg line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {book.title}
                      </h3>
                    </PrefetchLink>
                    {book.category && (
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-500/20 whitespace-nowrap shrink-0">
                        {book.category}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                    por {book.author}
                  </p>

                  <div className={`flex ${view === "list" ? "items-start" : "items-center"} justify-between ${view === "list" ? "mt-1 sm:mt-4" : "mt-auto pt-4 border-t border-gray-100 dark:border-white/5"}`}>
                    <div className="flex flex-wrap gap-1">
                      {book.price_digital > 0 && (
                        <button
                          onClick={() => handleAddToCart(book, 'digital')}
                          disabled={adding === `${book.id}-digital`}
                          className="text-[10px] sm:text-xs font-bold bg-blue-600 dark:bg-blue-600/30 hover:bg-blue-700 dark:hover:bg-blue-600/50 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1"
                        >
                          {adding === `${book.id}-digital` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                          Digital ${book.price_digital}
                        </button>
                      )}
                      {book.price_physical > 0 && book.stock_physical > 0 && (
                        <button
                          onClick={() => handleAddToCart(book, 'physical')}
                          disabled={adding === `${book.id}-physical`}
                          className="text-[10px] sm:text-xs font-bold bg-amber-600 dark:bg-amber-600/30 hover:bg-amber-700 dark:hover:bg-amber-600/50 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1"
                        >
                          {adding === `${book.id}-physical` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                          Físico ${book.price_physical}
                        </button>
                      )}
                    </div>
                    <PrefetchLink
                      href={`/book/${book.id}`}
                      bookId={book.id}
                      className="text-[10px] sm:text-sm font-medium bg-blue-600 dark:bg-blue-600/20 hover:bg-blue-700 dark:hover:bg-blue-600/30 text-white dark:text-blue-400 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl transition-all shadow-sm"
                    >
                      {view === "list" ? "Ver detalles" : "Detalles"}
                    </PrefetchLink>
                  </div>
                </div>
              </div>
              </CatalogBookCard>
              )
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// 3.1 - CatalogPage: Wrapper con Suspense para manejar searchParams en cliente
export default function CatalogPage() {
  return (
    <Suspense fallback={<main className="max-w-7xl mx-auto px-8 py-12"><CatalogSkeleton /></main>}>
      <CatalogContent />
    </Suspense>
  );
}
