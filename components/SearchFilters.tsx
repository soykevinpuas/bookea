"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, LayoutGrid, List, SlidersHorizontal, X } from "lucide-react";
import { useState, useEffect, useTransition } from "react";

interface SearchFiltersProps {
  initialSearch?: string;
  initialCategory?: string;
  initialView?: "grid" | "list";
}

export function SearchFilters({ 
  initialSearch = "", 
  initialCategory = "all", 
  initialView = "grid" 
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [view, setView] = useState(initialView);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Sync state with URL
  const updateFilters = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams?.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    startTransition(() => {
      router.push(`/catalog?${params.toString()}`);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch) {
        updateFilters({ search });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Barra de Búsqueda */}
        <div className="relative w-full md:flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por título o autor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-500/30 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Selector de Categoría (Desktop) */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              updateFilters({ category: e.target.value });
            }}
            className="hidden md:block pl-4 pr-10 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white appearance-none cursor-pointer"
          >
            <option value="all">Todas las categorías</option>
            <option value="Ficción">Ficción</option>
            <option value="No Ficción">No Ficción</option>
            <option value="Clásicos">Clásicos</option>
            <option value="Poesía">Poesía</option>
          </select>

          {/* Toggle de Vista */}
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
            >
              <LayoutGrid className="w-5 h-5" />
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
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          {/* Botón Filtros Móvil */}
          <button 
            onClick={() => setShowMobileFilters(true)}
            className="md:hidden flex-1 flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filtros
          </button>
        </div>
      </div>

      {/* Modal de Filtros Móvil */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200">
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filtros</h2>
              <button 
                onClick={() => setShowMobileFilters(false)}
                className="p-2 bg-gray-100 dark:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Categoría
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["all", "Ficción", "No Ficción", "Clásicos", "Poesía"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat);
                        updateFilters({ category: cat });
                        setShowMobileFilters(false);
                      }}
                      className={`px-4 py-2 rounded-xl text-sm transition-all border ${
                        category === cat 
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20" 
                          : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-white/10"
                      }`}
                    >
                      {cat === "all" ? "Todas" : cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de Carga */}
      {isPending && (
        <div className="h-0.5 w-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
          <div className="h-full bg-blue-600 animate-progress origin-left" />
        </div>
      )}
    </div>
  );
}
