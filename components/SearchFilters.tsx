"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, LayoutGrid, List, SlidersHorizontal, X, User, Grid3X3 } from "lucide-react";
import { useCallback, useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================
// SearchFilters: Componente de búsqueda y filtrado para el catálogo de libros
// Permite buscar por título/autor, filtrar por categoría y cambiar vista (grid/list)
// ============================================

interface SearchFiltersProps {
  initialSearch?: string;
  initialAuthor?: string;
  initialCategory?: string;
  initialView?: "grid" | "list" | "compact";
}

// Componente de filtros con valores iniciales desde URL
export function SearchFilters({
  initialSearch = "",
  initialAuthor = "",
  initialCategory = "all",
  initialView = "list"
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estado de transición para navegación no bloqueante
  const [isPending, startTransition] = useTransition();

  // Estados locales para búsqueda, categoría y vista
  const [search, setSearch] = useState(initialSearch);
  const [author, setAuthor] = useState(initialAuthor);
  const [category, setCategory] = useState(initialCategory);
  const [view, setView] = useState(initialView);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Función para sincronizar filtros con la URL
  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams?.toString());
    Object.entries(updates).forEach(([key, value]) => {
      // Limpiar parámetros vacíos o "all"
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Navegación con transición para no bloquear UI
    startTransition(() => {
      router.push(`/catalog?${params.toString()}`);
    });
  }, [router, searchParams, startTransition]);

  // Debounce de búsqueda (500ms) para evitar demasiadas actualizaciones
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch || author !== initialAuthor) {
        updateFilters({ search, author });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, author, initialAuthor, initialSearch, updateFilters]);

  // ============================================
  // Renderizado de la barra de filtros
  // ============================================
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Barra de búsqueda con ícono */}
        <div className="relative w-full md:flex-[2] group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-500/30 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>

        <div className="relative w-full md:flex-1 group">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Autor..."
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-500/30 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>

        {/* Controles de filtrado */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Botón Géneros — abre panel en todas las pantallas */}
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white hover:border-blue-500/30 transition-colors text-sm font-medium"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {category === "all" ? "Géneros" : category}
          </button>

          {/* Toggle de vista (Grid/List) */}
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10">
            <button
              onClick={() => {
                setView("grid");
                updateFilters({ view: "grid" });
              }}
              className={`p-2 rounded-lg transition-all ${
                view === "grid"
                  ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
              title="Cuadrícula"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setView("compact");
                updateFilters({ view: "compact" });
              }}
              className={`p-2 rounded-lg transition-all ${
                view === "compact"
                  ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
              title="Compacto"
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setView("list");
                updateFilters({ view: "list" });
              }}
              className={`p-2 rounded-lg transition-all ${
                view === "list"
                  ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
              title="Lista"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel de géneros para todas las pantallas */}
      <AnimatePresence>
        {showMobileFilters && (
          <motion.div
            key="mobile-filters-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Panel Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-gray-900 dark:text-white">Géneros</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:scale-110 active:scale-95 transition-transform"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-white/60" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto pr-1 -mr-1">
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    "all", "Ficción", "No Ficción", "Novela", "Clásicos",
                    "Misterio y Suspenso", "Fantasía", "Ciencia Ficción",
                    "Romance", "Terror", "Autoayuda", "Negocios y Finanzas",
                    "Historia", "Biografías", "Cuentos", "Poesía", "Otros"
                  ].map((cat: UntypedValue) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat);
                        updateFilters({ category: cat });
                        setShowMobileFilters(false);
                      }}
                      className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all border ${
                        category === cat
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-[1.02]"
                          : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-white/10 hover:border-blue-500/30 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {cat === "all" ? "Todas" : cat}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicador visual de carga durante transición */}
      {isPending && (
        <div className="h-0.5 w-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
          <div className="h-full bg-blue-600 animate-progress origin-left" />
        </div>
      )}
    </div>
  );
}
