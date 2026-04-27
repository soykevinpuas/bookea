"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import Book3D from "@/components/Book3D";
import BookLongPressMenu from "@/components/BookLongPressMenu";
import ProgressCircle from "@/components/ProgressCircle";
import { BookOpen, Trophy, Flame, Loader2, Compass, Search, LayoutGrid, List, X, WifiOff, History, User, Grid3X3, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { verifySubscriptionAction } from "@/lib/actions/subscriptions";
import { track } from "@/lib/analytics";

// 3.4 - DashboardPage: Panel principal del usuario con soporte offline y sección de lectura reciente
export default function DashboardPage() {
  const { userId } = useUserId();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"grid" | "list" | "compact">("grid");
  const [isOnline, setIsOnline] = useState(true);

  // 3.4.1 - Tracking de analytics: visita a dashboard
  useEffect(() => {
    track('page_view', { page: 'dashboard' }).catch(console.warn);
  }, []);

  // Detectar éxito de pago y verificar automáticamente
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment');

    if (paymentStatus === 'success' && sessionId) {
      const verify = async () => {
        const id = toast.loading("Sincronizando suscripción...");
        try {
          const result = await verifySubscriptionAction(sessionId);
          if (result.success) {
            toast.success("¡Bienvenido a Bookea Premium!", {
              id,
              description: "Tu suscripción se ha activado correctamente. Ya puedes disfrutar de todo el catálogo.",
              icon: <Sparkles className="w-5 h-5 text-amber-500" />,
              duration: 8000,
            });
            // Esperar un poco antes de limpiar la URL para evitar parpadeos
            setTimeout(() => {
              const newPath = window.location.pathname;
              window.history.replaceState({}, '', newPath);
            }, 2000);
          } else {
            toast.error("Hubo un problema al sincronizar", { id, description: result.error });
          }
        } catch (e) {
          toast.error("Error de conexión", { id });
        }
      };
      verify();
    }
  }, [searchParams]);

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
  
  // 3.4.2 - Los libros ya vienen con el plan B (offline) desde el hook useUserBooks
  // No necesitamos un estado local ruidoso separado aquí.
  const displayBooks = useMemo(() => {
    return allBooks || [];
  }, [allBooks]);

  // 3.4.2 - Lógica de 'Recientemente leídos' (Checkpoint)
  const recentBook = useMemo(() => {
    if (!displayBooks || displayBooks.length === 0) return null;
    
    // 3.4.2.1 - Ordenar copias locales por fecha de lectura para encontrar el verdadero "reciente"
    const sorted = [...displayBooks].sort((a, b) => {
      const timeA = new Date(a.last_read_at || 0).getTime();
      const timeB = new Date(b.last_read_at || 0).getTime();
      return timeB - timeA;
    });

    if (!isOnline) {
      // Buscar el primero que esté descargado y tenga algo de progreso
      return sorted.find(b => (b as any).isOfflineReady === true) || sorted[0];
    }
    
    return sorted[0];
  }, [displayBooks, isOnline]);

  const books = useMemo(() => {
    if (!displayBooks) return [];
    let filtered = [...displayBooks];

    // 3.4.1.2 - Filtro Offline: Solo mostrar libros descargados si no hay internet
    if (!isOnline) {
      filtered = filtered.filter(b => (b as any).isOfflineReady === true);
    }

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(b => b.title?.toLowerCase().includes(s));
    }
    if (authorSearch) {
      const a = authorSearch.toLowerCase();
      filtered = filtered.filter(b => b.author?.toLowerCase().includes(a));
    }
    if (category && category !== "all") {
      filtered = filtered.filter(b => b.category === category);
    }
    return filtered;
  }, [displayBooks, search, authorSearch, category, isOnline]);

  const categories = ["Ficción", "Novela", "Clásicos", "Misterio", "Fantasía", "Historia", "Otros"];

  // 3.4.6 - Loading con soporte offline: no quedarnos en loading si el hook ya devolvió algo (aunque sea del caché)
  if (isLoading && isOnline && displayBooks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
      </div>
    );
  }

  const stats = [
    { label: "Colección", value: displayBooks?.length || 0, icon: BookOpen, color: "text-blue-400" },
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
                <div className="flex items-center justify-center sm:justify-start gap-4 mb-2">
                  <h3 className="text-xl font-black group-hover:text-blue-400 transition-colors truncate">{recentBook.title}</h3>
                  {recentBook.percent_complete !== undefined && (
                    <ProgressCircle progress={recentBook.percent_complete} size={32} />
                  )}
                </div>
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
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black">Mi Biblioteca</h1>
            {!isOnline && (
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-[0.2em] animate-pulse">
                Libros Descargados
              </span>
            )}
          </div>
          {isOnline && (
            <Link 
              href="/catalog" 
              className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center gap-2 uppercase tracking-widest"
            >
              Catálogo <Compass className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-[2]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Autor..."
              value={authorSearch}
              onChange={(e) => setAuthorSearch(e.target.value)}
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
               <button onClick={() => setView("grid")} className={`p-2 rounded-lg ${view === "grid" ? "bg-white/10" : "text-white/40"}`} title="Cuadrícula"><LayoutGrid className="w-4 h-4" /></button>
               <button onClick={() => setView("compact")} className={`p-2 rounded-lg ${view === "compact" ? "bg-white/10" : "text-white/40"}`} title="Compacto"><Grid3X3 className="w-4 h-4" /></button>
               <button onClick={() => setView("list")} className={`p-2 rounded-lg ${view === "list" ? "bg-white/10" : "text-white/40"}`} title="Lista"><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {displayBooks.length === 0 ? (
          <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
            <BookOpen className="w-12 h-12 mx-auto text-white/10 mb-4" />
            <p className="text-white/40">No hay libros que mostrar</p>
          </div>
        ) : (
          <div className={
            view === "grid" ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6" : 
            view === "compact" ? "grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-3" : 
            "space-y-4"
          }>
            {books.map((book) => (
              view === "grid" ? (
              <BookLongPressMenu book={book} key={book.id}>
                <div className="flex flex-col gap-3 group">
                      <Link href={`/reader/${book.id}`}>
                    <div className="aspect-[2/3] transition-transform group-hover:scale-105 relative">
                      <Book3D src={book.cover_url || ""} title={book.title} />
                      {book.percent_complete !== undefined && (
                        <div className="absolute -bottom-2 -right-2 z-20 bg-[#0a0a0a] rounded-full p-1 shadow-xl border border-white/10">
                          <ProgressCircle progress={book.percent_complete} size={30} />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="text-center">
                    <h3 className="text-xs font-bold truncate">{book.title}</h3>
                    <p className="text-[10px] text-white/40 truncate">{book.author}</p>
                  </div>
                </div>
              </BookLongPressMenu>
              ) : view === "compact" ? (
                <BookLongPressMenu book={book} key={book.id}>
                  <Link href={`/reader/${book.id}`} className="block group">
                    <div className="aspect-[2/3] transition-transform group-hover:scale-110 relative shadow-lg rounded-lg overflow-hidden">
                      <Book3D src={book.cover_url || ""} title={book.title} />
                      {book.percent_complete !== undefined && (
                        <div className="absolute bottom-1 right-1 z-20">
                          <ProgressCircle progress={book.percent_complete} size={22} strokeWidth={2} />
                        </div>
                      )}
                    </div>
                  </Link>
                </BookLongPressMenu>
              ) : (
                <BookLongPressMenu book={book} key={book.id}>
                  <Link href={`/reader/${book.id}`} className="flex items-center gap-4 p-2 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                    <div className="w-10 h-14 flex-shrink-0"><Book3D src={book.cover_url || ""} title={book.title} /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate">{book.title}</h3>
                      <p className="text-xs text-white/40 truncate">{book.author}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {book.percent_complete !== undefined && (
                        <ProgressCircle progress={book.percent_complete} size={24} />
                      )}
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">Leer</button>
                    </div>
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
