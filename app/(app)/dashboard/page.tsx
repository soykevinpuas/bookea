"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import Book3D from "@/components/Book3D";
import BookLongPressMenu from "@/components/BookLongPressMenu";
import { BookOpen, Trophy, Flame, Loader2, Compass, Search, LayoutGrid, List, X, WifiOff, History } from "lucide-react";

// 3.4 - DashboardPage: Panel principal del usuario con soporte offline y sección de lectura reciente
export default function DashboardPage() {
  const { userId } = useUserId();
  const router = useRouter();
  
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isOnline, setIsOnline] = useState(true);

  // 3.4.1 - Detección de estado de conexión
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const { data: allBooks, isLoading } = useUserBooks(userId);

  // 3.4.2 - Lógica de 'Recientemente leídos' (Checkpoint)
  const recentBook = useMemo(() => {
    if (!allBooks || allBooks.length === 0) return null;
    // Por ahora tomamos el primero, asumiendo orden por fecha en el futuro
    return allBooks[0];
  }, [allBooks]);

  const books = useMemo(() => {
    if (!allBooks) return [];
    let filtered = [...allBooks];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(b => b.title?.toLowerCase().includes(s) || b.author?.toLowerCase().includes(s));
    }
    if (category && category !== "all") {
      filtered = filtered.filter(b => b.category === category);
    }
    return filtered;
  }, [allBooks, search, category]);

  const categories = ["Ficción", "Novela", "Clásicos", "Misterio", "Fantasía", "Historia", "Otros"];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
      </div>
    );
  }

  const stats = [
    { label: "Colección", value: allBooks?.length || 0, icon: BookOpen, color: "text-blue-400" },
    { label: "Terminados", value: 0, icon: Trophy, color: "text-yellow-400" },
    { label: "Racha", value: "1 día", icon: Flame, color: "text-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      {/* 3.4.3 - Banner Offline */}
      {!isOnline && (
        <div className="bg-orange-600/20 border-b border-orange-500/20 py-2 px-6 flex items-center justify-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
          <WifiOff className="w-3 h-3" /> Modo Offline Activado - Solo libros descargados disponibles
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* 3.4.4 - Sección Reciente */}
        {recentBook && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <History className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Continuar leyendo</h2>
            </div>
            <Link 
              href={`/reader/${recentBook.id}`}
              className="group relative flex flex-col sm:flex-row items-center gap-6 p-6 bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-blue-500/30 transition-all shadow-2xl"
            >
              <div className="w-24 h-36 flex-shrink-0 shadow-xl group-hover:scale-105 transition-transform">
                <Book3D src={recentBook.cover_url || ""} title={recentBook.title} />
              </div>
              <div className="flex-1 text-center sm:text-left z-10">
                <h3 className="text-xl font-black mb-1 group-hover:text-blue-400 transition-colors">{recentBook.title}</h3>
                <p className="text-white/40 text-sm mb-4">{recentBook.author}</p>
                <div className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/20">
                  Reanudar lectura
                </div>
              </div>
            </Link>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
                <div>
                  <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black">Mi Biblioteca</h1>
          {isOnline && (
            <Link href="/catalog" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 uppercase tracking-widest">
              Explorar <Compass className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 bg-white/5 border border-white/10 rounded-xl text-xs"
            >
              <option value="all">Todo</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
               <button onClick={() => setView("grid")} className={`p-2 rounded-lg ${view === "grid" ? "bg-white/10" : "text-white/40"}`}><LayoutGrid className="w-4 h-4" /></button>
               <button onClick={() => setView("list")} className={`p-2 rounded-lg ${view === "list" ? "bg-white/10" : "text-white/40"}`}><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
            <BookOpen className="w-12 h-12 mx-auto text-white/10 mb-4" />
            <p className="text-white/40">No hay libros que mostrar</p>
          </div>
        ) : (
          <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6" : "space-y-4"}>
            {books.map((book) => (
              view === "grid" ? (
              <BookLongPressMenu bookId={book.id} bookTitle={book.title} epubUrl={book.epub_url || undefined}>
                <div key={book.id} className="flex flex-col gap-3 group">
                  <Link href={`/reader/${book.id}`}>
                    <div className="aspect-[2/3] transition-transform group-hover:scale-105">
                      <Book3D src={book.cover_url || ""} title={book.title} />
                    </div>
                  </Link>
                  <div className="text-center">
                    <h3 className="text-xs font-bold truncate">{book.title}</h3>
                    <p className="text-[10px] text-white/40 truncate">{book.author}</p>
                  </div>
                </div>
              </BookLongPressMenu>
              ) : (
                <BookLongPressMenu bookId={book.id} bookTitle={book.title} epubUrl={book.epub_url || undefined}>
                  <Link key={book.id} href={`/reader/${book.id}`} className="flex items-center gap-4 p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                    <div className="w-12 h-16 flex-shrink-0"><Book3D src={book.cover_url || ""} title={book.title} /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate">{book.title}</h3>
                      <p className="text-xs text-white/40 truncate">{book.author}</p>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Leer</button>
                  </Link>
                </BookLongPressMenu>
              )
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
