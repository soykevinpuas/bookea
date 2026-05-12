"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import { useCoins, useStreak } from "@/hooks/useCoins";
import { useProfile } from "@/hooks/useAvatars";
import Book3D from "@/components/Book3D";
import BookLongPressMenu from "@/components/BookLongPressMenu";
import ProgressCircle from "@/components/ProgressCircle";
import { BookOpen, Trophy, Flame, Loader2, Compass, Search, LayoutGrid, List, X, WifiOff, History, User, Grid3X3, Sparkles, Circle, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { verifySubscriptionAction } from "@/lib/actions/subscriptions";
import { track } from "@/lib/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/stores/cart";
import { DashboardSkeleton } from "@/components/ui/LoadingStates";

// 3.4 - DashboardPage: Panel principal del usuario con soporte offline y sección de lectura reciente
// Componente interno con toda la lógica del Dashboard
function DashboardContent() {
  const { userId } = useUserId();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"grid" | "list" | "compact">("grid");
  const [showGenres, setShowGenres] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const queryClient = useQueryClient();

  // 3.4.1 - Tracking de analytics: visita a dashboard
  useEffect(() => {
    track('page_view', { page: 'dashboard' }).catch(console.warn);
  }, []);

  // Detectar éxito de pago y verificar (polling hasta que el webhook procese)
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment');

    if (paymentStatus === 'success' && sessionId) {
      let attempts = 0;
      const maxAttempts = 15;
      let toastId: string | number = "";

      const poll = async () => {
        if (attempts === 0) {
          toastId = toast.loading("Procesando tu pago...");
        }

        try {
          const result: any = await verifySubscriptionAction(sessionId);

            if (result.success) {
            if (result.type === 'subscription') {
              toast.success("¡Bienvenido a Bookea Premium!", {
                id: toastId,
                description: "Tu suscripción se ha activado correctamente. Ya puedes disfrutar de todo el catálogo.",
                icon: <Sparkles className="w-5 h-5 text-amber-500" />,
                duration: 8000,
              });
            } else if (result.type === 'payment' && result.items) {
              toast.success("¡Compra completada!", {
                id: toastId,
                description: result.items.join(", "),
                duration: 6000,
              });
            }
            useCartStore.getState().clearCart();
            queryClient.invalidateQueries({ queryKey: ['userBooks', userId] });
            setTimeout(() => {
              window.history.replaceState({}, '', window.location.pathname);
            }, 2000);
            return;
          }

          if (result.pending && attempts < maxAttempts) {
            attempts++;
            toast.loading("Sincronizando pago...", { id: toastId });
            setTimeout(poll, 2000);
            return;
          }

          toast.error("Hubo un problema al sincronizar", {
            id: toastId,
            description: "Intenta recargar la página o contacta a soporte.",
          });
        } catch {
          toast.error("Error de conexión", { id: toastId });
        }
      };

      poll();
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
  const { data: coinsBalance } = useCoins(userId);
  const { data: streak } = useStreak(userId);
  const { profile } = useProfile(userId);

  const displayBooks = useMemo(() => {
    return allBooks || [];
  }, [allBooks]);

  const recentBook = useMemo(() => {
    if (!displayBooks || displayBooks.length === 0) return null;
    const sorted = [...displayBooks].sort((a, b) => {
      const timeA = new Date(a.last_read_at || 0).getTime();
      const timeB = new Date(b.last_read_at || 0).getTime();
      return timeB - timeA;
    });

    if (!isOnline) {
      return sorted.find((b: any) => (b as any).isOfflineReady === true) || sorted[0];
    }
    return sorted[0];
  }, [displayBooks, isOnline]);

  const totalCompleted = useMemo(() => {
    return displayBooks?.filter((b: any) => (b.percent_complete || 0) >= 100).length ?? 0;
  }, [displayBooks]);

  const books = useMemo(() => {
    if (!displayBooks) return [];
    let filtered = [...displayBooks];
    if (!isOnline) filtered = filtered.filter((b: any) => (b as any).isOfflineReady === true);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((b: any) => b.title?.toLowerCase().includes(s));
    }
    if (authorSearch) {
      const a = authorSearch.toLowerCase();
      filtered = filtered.filter((b: any) => b.author?.toLowerCase().includes(a));
    }
    if (category && category !== "all") {
      filtered = filtered.filter((b: any) => b.category === category);
    }
    return filtered;
  }, [displayBooks, search, authorSearch, category, isOnline]);

  const categories = ["Ficción", "No Ficción", "Novela", "Clásicos", "Misterio y Suspenso", "Fantasía", "Ciencia Ficción", "Romance", "Terror", "Autoayuda", "Negocios y Finanzas", "Historia", "Biografías", "Cuentos", "Poesía", "Otros"];

  if (isLoading && isOnline && displayBooks.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f0eb] dark:bg-[#0a0a0a] p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0eb] dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-white selection:bg-blue-500/30">
      {!isOnline && (
        <div className="bg-orange-600/20 border-b border-orange-500/20 py-2 px-6 flex items-center justify-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
          <WifiOff className="w-3 h-3" /> Modo Offline Activado - Solo libros descargados disponibles
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12">
        {recentBook && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <History className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Continuar leyendo</h2>
            </div>
            <Link 
              href={`/reader/${recentBook.id}`}
              className="group relative flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all shadow-lg"
            >
                <div className="w-16 h-24 flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                 <Book3D src={recentBook.cover_url || ""} title={recentBook.title} percentComplete={recentBook.percent_complete} />
               </div>
              <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-black group-hover:text-blue-400 transition-colors truncate max-w-[180px] sm:max-w-md">{recentBook.title}</h3>
                  {recentBook.percent_complete !== undefined && (
                    <ProgressCircle progress={recentBook.percent_complete} size={24} />
                  )}
                </div>
                <p className="text-gray-400 dark:text-white/40 text-xs mb-3 truncate">{recentBook.author}</p>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider">
                  Continuar
                </div>
              </div>
            </Link>
          </section>
        )}

        <div className="grid grid-cols-3 gap-3 mb-12">
          <div className={`text-center p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border backdrop-blur-md transition-all duration-500 ${
            (streak || 0) > 0 ? 'border-orange-500/30 shadow-[0_0_20px_rgba(244,114,44,0.1)]' : 'border-gray-100 dark:border-white/10'
          }`}>
            <Flame className={`w-5 h-5 mx-auto mb-1 transition-colors ${(streak || 0) > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-300 dark:text-white/20'}`} />
            <p className="text-lg font-black text-gray-900 dark:text-white">{streak ?? 0}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase font-bold tracking-tight">Racha</p>
          </div>
          <div className={`text-center p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border backdrop-blur-md transition-all duration-500 ${
            totalCompleted > 0 ? 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-gray-100 dark:border-white/10'
          }`}>
            <Trophy className={`w-5 h-5 mx-auto mb-1 ${(totalCompleted || 0) > 0 ? 'text-amber-500' : 'text-gray-300 dark:text-white/20'}`} />
            <p className="text-lg font-black text-gray-900 dark:text-white">{totalCompleted}</p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase font-bold tracking-tight">Leídos</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 backdrop-blur-md">
            <Circle className="w-5 h-5 mx-auto text-amber-400 fill-current mb-1" />
            <p className="text-lg font-black text-gray-900 dark:text-white">
              {coinsBalance ? (coinsBalance.bronze || 0) + (coinsBalance.silver || 0) + (coinsBalance.gold || 0) + (coinsBalance.diamond || 0) : 0}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-white/40 uppercase font-bold tracking-tight">Monedas</p>
          </div>
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
              className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transform hover:-translate-y-1 flex items-center gap-2 uppercase tracking-widest"
            >
              Catálogo <Compass className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-[2]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
            <input
              type="text"
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl text-sm focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
            <input
              type="text"
              placeholder="Autor..."
              value={authorSearch}
              onChange={(e) => setAuthorSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl text-sm focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGenres(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl text-xs font-medium text-gray-900 dark:text-white hover:border-blue-500/30 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {category === "all" ? "Géneros" : category}
            </button>
            <div className="flex bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/10">
               <button onClick={() => setView("grid")} className={`p-2 rounded-lg ${view === "grid" ? "bg-gray-200 dark:bg-white/10" : "text-gray-400 dark:text-white/40"}`} title="Cuadrícula"><LayoutGrid className="w-4 h-4" /></button>
               <button onClick={() => setView("compact")} className={`p-2 rounded-lg ${view === "compact" ? "bg-gray-200 dark:bg-white/10" : "text-gray-400 dark:text-white/40"}`} title="Compacto"><Grid3X3 className="w-4 h-4" /></button>
               <button onClick={() => setView("list")} className={`p-2 rounded-lg ${view === "list" ? "bg-white/10" : "text-white/40"}`} title="Lista"><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Panel de géneros */}
        <AnimatePresence>
          {showGenres && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGenres(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
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
                    onClick={() => setShowGenres(false)}
                    className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:scale-110 active:scale-95 transition-transform"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-white/60" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto pr-1 -mr-1">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => { setCategory("all"); setShowGenres(false); }}
                      className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all border ${
                        category === "all"
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-[1.02]"
                          : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-white/10 hover:border-blue-500/30 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      Todas
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat); setShowGenres(false); }}
                        className={`px-4 py-3 rounded-2xl text-sm font-bold transition-all border ${
                          category === cat
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-[1.02]"
                            : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-white/10 hover:border-blue-500/30 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                      <Book3D src={book.cover_url || ""} title={book.title} percentComplete={book.percent_complete} />
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
                      <Book3D src={book.cover_url || ""} title={book.title} percentComplete={book.percent_complete} />
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
                    <div className="w-10 h-14 flex-shrink-0"><Book3D src={book.cover_url || ""} title={book.title} percentComplete={book.percent_complete} /></div>
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

// 3.4 - DashboardPage: Panel principal envuelto en Suspense para manejar useSearchParams en producción
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f0eb] dark:bg-[#0a0a0a] p-6"><DashboardSkeleton /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
