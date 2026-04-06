"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import Book3D from "@/components/Book3D";
import { BookOpen, Trophy, Flame, Loader2, Compass, Search, LayoutGrid, List, X } from "lucide-react";

// 3.4 - DashboardPage: Panel principal del usuario que muestra su biblioteca personal, estadísticas de lectura y filtros de búsqueda
export default function DashboardPage() {
  // 3.4.1 - Obtención del ID del usuario autenticado mediante el hook useUserId
  const { userId } = useUserId();
  const router = useRouter();
  
  // 3.4.2 - Estados locales para filtros de búsqueda
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  // 3.4.3 - Consulta de los libros adquiridos por el usuario mediante React Query
  const { data: allBooks, isLoading } = useUserBooks(userId);

  // 3.4.4 - Filtrado local de libros
  const books = useMemo(() => {
    if (!allBooks) return [];
    
    let filtered = [...allBooks];
    
    // Filtro de búsqueda
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(book => 
        book.title?.toLowerCase().includes(searchLower) || 
        book.author?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filtro de categoría
    if (category && category !== "all") {
      filtered = filtered.filter(book => book.category === category);
    }
    
    return filtered;
  }, [allBooks, search, category]);

  // 3.4.5 - Categorías disponibles para filtrado
  const categories = [
    "Ficción", "No Ficción", "Novela", "Clásicos", "Misterio y Suspenso",
    "Fantasía", "Ciencia Ficción", "Romance", "Terror", "Autoayuda",
    "Negocios y Finanzas", "Historia", "Biografías", "Cuentos", "Poesía", "Otros"
  ];

  // 3.4.6 - Estado de carga inicial mientras se obtienen los datos del usuario
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] retro:bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
      </div>
    );
  }

  // 3.4.7 - Estadísticas de lectura del usuario (colección, libros terminados, racha actual)
  const stats = [
    { label: "Colección", value: allBooks?.length || 0, icon: BookOpen, color: "text-blue-400" },
    { label: "Terminados", value: 0, icon: Trophy, color: "text-yellow-400" },
    { label: "Racha", value: "1 día", icon: Flame, color: "text-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] dark:bg-[#0a0a0a] retro:bg-[#0d1117] text-white selection:bg-blue-500/30">
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* 3.4.8 - Encabezado con estadísticas de lectura en cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3.4.9 - Título de sección con enlace de navegación al catálogo completo */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Mi Biblioteca</h1>
          <Link href="/catalog" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
            Explorar más <Compass className="w-4 h-4" />
          </Link>
        </div>

        {/* 3.4.10 - Barra de filtros de búsqueda y categoría */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* 3.4.10.1 - Input de búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por título o autor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 3.4.10.2 - Selector de categoría */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
          >
            <option value="all" className="bg-[#1a1a1a]">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className="bg-[#1a1a1a]">{cat}</option>
            ))}
          </select>

          {/* 3.4.10.3 - Toggle de vista (Grid/List) */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setView("grid")}
              className={`p-2 rounded-lg transition-all ${
                view === "grid" 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-all ${
                view === "list" 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-white/40 hover:text-white"
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3.4.11 - Renderizado condicional: Estado vacío (Empty State) cuando el usuario no tiene libros */}
        {!allBooks || allBooks.length === 0 ? (
          <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-16 text-center backdrop-blur-sm">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Tu estantería está vacía</h3>
            <p className="text-white/40 mb-8 max-w-sm mx-auto">Comienza tu viaje literario adquiriendo tu primer libro en el catálogo premium.</p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Ir al Catálogo
            </Link>
          </div>
        ) : books.length === 0 ? (
          // 3.4.12 - Estado cuando no hay resultados con los filtros aplicados
          <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-16 text-center backdrop-blur-sm">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No se encontraron libros</h3>
            <p className="text-white/40 mb-8 max-w-sm mx-auto">No hay libros que coincidan con tu búsqueda o filtro.</p>
            <button
              onClick={() => { setSearch(""); setCategory("all"); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-all"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          // 3.4.13 - Grid/List de libros adquiridos con acceso directo al lector
          <div className={view === "grid" 
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
            : "flex flex-col gap-4"
          }>
            {books.map((book) => (
              view === "grid" ? (
                <div key={book.id} className="flex flex-col items-center">
                  {/* 3.4.13.1 - Tarjeta del libro en vista grid */}
                  <Link href={`/book/${book.id}`} className="w-full">
                    <Book3D 
                      src={book.cover_url || ""} 
                      title={book.title} 
                      className="w-full aspect-[2/3]"
                    />
                  </Link>
                  {/* 3.4.13.2 - Información del libro */}
                  <div className="text-center w-full mt-3">
                    <h3 className="font-bold text-sm line-clamp-1 mb-1">{book.title}</h3>
                    <p className="text-xs text-white/40 line-clamp-1 mb-2">{book.author}</p>
                    <Link 
                      href={`/reader/${book.id}`}
                      className="inline-block w-full py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                      Leer
                    </Link>
                  </div>
                </div>
              ) : (
                // 3.4.13.3 - Tarjeta del libro en vista list
                <div 
                  key={book.id} 
                  onClick={() => router.push(`/book/${book.id}`)}
                  className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group"
                >
                  <Book3D 
                    src={book.cover_url || ""} 
                    title={book.title} 
                    className="w-14 h-20 flex-shrink-0"
                    showShadow={false}
                    objectFit="contain"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm sm:text-base line-clamp-1 group-hover:text-blue-400 transition-colors">{book.title}</h3>
                    <p className="text-[11px] sm:text-sm text-white/40 line-clamp-1">{book.author}</p>
                    {book.category && (
                      <span className="inline-block mt-1 text-[9px] sm:text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-white/60">
                        {book.category}
                      </span>
                    )}
                  </div>
                  <Link 
                    href={`/reader/${book.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-500 transition-all flex-shrink-0"
                  >
                    Leer
                  </Link>
                </div>
              )
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
