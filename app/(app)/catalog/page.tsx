"use client";

import { useBooks, useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import { useSubscription } from "@/hooks/useSubscription";
import Book3D from "@/components/Book3D";
import CatalogBookCard from "@/components/CatalogBookCard";
import Card from "@/components/ui/Card";
import { useSearchParams, useRouter } from "next/navigation";
import { CatalogSkeleton, PrefetchLink } from "@/components/ui/LoadingStates";
import { useMemo, useState, Suspense, useEffect } from "react";
import { useIsClient } from "@/hooks/useIsClient";
import { Book } from "@/types/book";
import { useCartStore } from "@/stores/cart";
import { ShoppingCart, Loader2, CheckCircle2, Search, LayoutGrid, List, Zap } from "lucide-react";
import { toast } from "sonner";

// CatalogContent: Lógica interna del catálogo con React Query para velocidad SPA
function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem, items: cartItems } = useCartStore();
  const [adding, setAdding] = useState<string | null>(null);
  const isInCart = (bookId: string, type: string) => cartItems.some(i => i.book_id === bookId && i.type === type);
  const { userId } = useUserId();
  const { data: subscription } = useSubscription(userId);
  // Solo admin filtra por su admin_stock; vendedor/free/subscriber ven catálogo completo
  const adminId = subscription?.role === 'admin' ? userId : undefined;
  const { data: userBooks } = useUserBooks(userId || '');

  // Evita ofrecer compra digital cuando el usuario ya posee acceso permanente.
  const ownedDigitalIds = useMemo(() => {
    if (!userBooks) return new Set<string>();
    return new Set(userBooks.filter((b) => b.access_type === 'permanent').map((b) => b.id));
  }, [userBooks]);

  const showDigital = !subscription || (!subscription.isActive && subscription.role !== 'vendedor' && subscription.role !== 'admin');
  const showPhysical = !subscription || subscription.role !== 'vendedor';

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "all");
  const [viewMode, setViewMode] = useState(searchParams.get("view") as "grid" | "list" || "list");
  const [tab, setTab] = useState(searchParams.get("tab") || "todos");
  const mounted = useIsClient();

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [debouncedCategory, setDebouncedCategory] = useState(categoryFilter);

  // Debounce corto: sincroniza filtros con URL sin reemplazar ruta en cada tecla.
  useEffect(() => {
    if (!mounted) { setDebouncedQuery(searchQuery); setDebouncedCategory(categoryFilter); return; }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setDebouncedCategory(categoryFilter);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("view", viewMode);
      if (tab !== "todos") params.set("tab", tab);
      router.replace(`/catalog${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, viewMode, tab, mounted, router]);

  const { data: booksData, isLoading } = useBooks({ search: debouncedQuery, category: debouncedCategory, adminId });

  const isVendedor = subscription?.role === 'vendedor';

  // Tabs de negocio: lector filtra por formato; vendedor conserva todo el catálogo.
  const filteredByTab = useMemo(() => {
    if (!booksData) return [];
    if (isVendedor) return booksData;
    return booksData.filter((b: Book) => {
      if (tab === 'digitales') return !!b.epub_url;
      if (tab === 'fisicos') return b.price_physical > 0 && b.stock_physical > 0;
      // Todos: digitales siempre; físicos solo con stock (oculta solo-físico sin inventario)
      if (b.epub_url) return true;
      return b.price_physical > 0 && b.stock_physical > 0;
    });
  }, [booksData, tab, isVendedor]);

  const categories = ["Ficción", "No Ficción", "Novela", "Clásicos", "Misterio y Suspenso", "Fantasía", "Ciencia Ficción", "Romance", "Terror", "Autoayuda", "Negocios y Finanzas", "Historia", "Biografías", "Cuentos", "Poesía", "Otros"];

  // Agrega al carrito y abre el panel para confirmar visualmente la accion.
  const handleAddToCart = async (book: Book, type: 'digital' | 'physical') => {
    const key = `${book.id}-${type}`
    setAdding(key)
    try {
      await addItem(book.id, type)
      useCartStore.getState().setOpen(true)
      toast.success(`${book.title} agregado (${type === 'digital' ? 'Digital' : 'Físico'})`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al agregar al carrito')
    } finally {
      setAdding(null)
    }
  }

  if (isLoading && filteredByTab.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <CatalogSkeleton variant={viewMode} />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] retro:bg-[#0d1117] transition-colors duration-300">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Catálogo
            </h1>
            {/* Selector de formato visible solo para roles compradores. */}
            {!isVendedor && (
              <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-zinc-800/50 rounded-lg">
                {[
                  { key: 'todos', label: 'Todos' },
                  { key: 'digitales', label: 'Digitales' },
                  { key: 'fisicos', label: 'Físicos' },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                      tab === t.key
                        ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Barra de busqueda y filtros persistidos en query params. */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por título o autor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50 transition-shadow"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-sm text-gray-600 dark:text-zinc-400 font-medium focus:ring-2 focus:ring-blue-500/50 transition-shadow"
          >
            <option value="all">Género</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-zinc-800/50 rounded-lg">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`} title="Cuadrícula"><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`} title="Lista"><List className="w-4 h-4" /></button>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mb-2">Mostrando {filteredByTab.length} de {booksData?.length || 0} libros</p>
        {filteredByTab.length === 0 ? (
          <Card className="text-center py-20">
            <span className="text-4xl block mb-4">🔍</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Sin resultados</h3>
            <p className="text-gray-500 dark:text-gray-400">No encontramos libros que coincidan con tu búsqueda.</p>
          </Card>
        ) : (
          /* Misma data con dos layouts: grid visual o lista compacta. */
          <div className={
            viewMode === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
              : "flex flex-col gap-3"
          }>
            {filteredByTab.map((book: Book) => (
              viewMode === "grid" ? (
              <CatalogBookCard key={book.id} book={book}>
                <Card className="flex flex-col overflow-hidden h-full">
                  <PrefetchLink href={`/book/${book.id}`} bookId={book.id}>
                    <div className="aspect-[2/3] relative">
                      <Book3D src={book.cover_url || ""} title={book.title} />
                    </div>
                  </PrefetchLink>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <PrefetchLink href={`/book/${book.id}`} bookId={book.id}>
                      <h3 className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">{book.title}</h3>
                    </PrefetchLink>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 line-clamp-1">{book.author}</p>
                    <div className="flex items-start gap-1.5 mt-auto pt-2">
                      {subscription?.role === 'vendedor' ? (
                        book.epub_url ? (
                          <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                            <Zap className="w-3 h-3 fill-green-400" /> Disponible
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-500 bg-white/5 border border-white/10 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                            <Zap className="w-3 h-3" /> Sin epub
                          </span>
                        )
                      ) : (
                        <>
                      {showDigital && book.price_digital > 0 && book.epub_url && (
                        ownedDigitalIds.has(book.id) ? (
                          <span className="text-[10px] font-semibold text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" /> Adquirido
                          </span>
                        ) : isInCart(book.id, 'digital') ? (
                          <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                            <ShoppingCart className="w-3 h-3" /> En carrito
                          </span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <button onClick={() => handleAddToCart(book, 'digital')} disabled={adding === `${book.id}-digital`}
                              className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                            >
                              {adding === `${book.id}-digital` ? <Loader2 className="w-3 h-3 animate-spin" /> : `$${book.price_digital}`}
                            </button>
                            <span className="text-[9px] text-gray-400 dark:text-zinc-500">Digital</span>
                          </div>
                        )
                      )}
                      {showPhysical && book.price_physical > 0 && book.stock_physical > 0 && (
                        isInCart(book.id, 'physical') ? (
                          <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                            <ShoppingCart className="w-3 h-3" /> En carrito
                          </span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <button onClick={() => handleAddToCart(book, 'physical')} disabled={adding === `${book.id}-physical`}
                              className="text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                            >
                              {adding === `${book.id}-physical` ? <Loader2 className="w-3 h-3 animate-spin" /> : `$${book.price_physical}`}
                            </button>
                            <span className="text-[9px] text-gray-400 dark:text-zinc-500">Físico</span>
                          </div>
                        )
                      )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </CatalogBookCard>
              ) : (
              <CatalogBookCard key={book.id} book={book}>
                <Card className="flex items-center gap-4 p-3 overflow-hidden">
                  <PrefetchLink href={`/book/${book.id}`} bookId={book.id} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-[72px] shrink-0">
                      <Book3D src={book.cover_url || ""} title={book.title} objectFit="contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{book.title}</h3>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">por {book.author}</p>
                      {book.category && (
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">{book.category}</span>
                      )}
                    </div>
                  </PrefetchLink>
                  <div className="flex items-start gap-2 shrink-0">
                    {subscription?.role === 'vendedor' ? (
                      book.epub_url ? (
                        <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                          <Zap className="w-3 h-3 fill-green-400" /> Disponible
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-500 bg-white/5 border border-white/10 px-2 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                          <Zap className="w-3 h-3" /> Sin epub
                        </span>
                      )
                    ) : (
                      <>
                    {showDigital && book.price_digital > 0 && book.epub_url && (
                      ownedDigitalIds.has(book.id) ? (
                        <span className="text-[10px] font-semibold text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3" /> Adquirido
                        </span>
                      ) : isInCart(book.id, 'digital') ? (
                        <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                          <ShoppingCart className="w-3 h-3" /> En carrito
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <button onClick={() => handleAddToCart(book, 'digital')} disabled={adding === `${book.id}-digital`}
                            className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                          >
                            {adding === `${book.id}-digital` ? <Loader2 className="w-3 h-3 animate-spin" /> : `$${book.price_digital}`}
                          </button>
                          <span className="text-[9px] text-gray-400 dark:text-zinc-500">Digital</span>
                        </div>
                      )
                    )}
                    {showPhysical && book.price_physical > 0 && book.stock_physical > 0 && (
                      isInCart(book.id, 'physical') ? (
                        <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
                          <ShoppingCart className="w-3 h-3" /> En carrito
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <button onClick={() => handleAddToCart(book, 'physical')} disabled={adding === `${book.id}-physical`}
                            className="text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                          >
                            {adding === `${book.id}-physical` ? <Loader2 className="w-3 h-3 animate-spin" /> : `$${book.price_physical}`}
                          </button>
                          <span className="text-[9px] text-gray-400 dark:text-zinc-500">Físico</span>
                        </div>
                      )
                    )}
                    </>
                    )}
                  </div>
                </Card>
              </CatalogBookCard>
              )
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// CatalogPage: Wrapper con Suspense para manejar searchParams en cliente
export default function CatalogPage() {
  return (
    <Suspense fallback={<main className="max-w-7xl mx-auto px-8 py-12"><CatalogSkeleton /></main>}>
      <CatalogContent />
    </Suspense>
  );
}
