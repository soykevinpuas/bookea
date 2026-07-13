"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useUserBooks } from "@/hooks/useBooks";
import { useUserId } from "@/hooks/useUser";
import Book3D from "@/components/Book3D";
import BookLongPressMenu from "@/components/BookLongPressMenu";
import ProgressCircle from "@/components/ProgressCircle";
import Card from "@/components/ui/Card";
import { BookOpen, BookOpenCheck, Compass, Search, WifiOff, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { verifySubscriptionAction } from "@/lib/actions/subscriptions";
import { track } from "@/lib/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/stores/cart";
import { DashboardSkeleton } from "@/components/ui/LoadingStates";
import PanelOnboarding from "@/components/ui/PanelOnboarding";
import AccessBadge from "@/components/ui/AccessBadge";
import { useIsClient } from "@/hooks/useIsClient";

type PaymentVerificationResult =
  | { success: true; type: "subscription" }
  | { success: true; type: "payment"; items?: string[] }
  | { success: false; pending?: boolean; error?: string };

const paymentVerificationInFlight = new Set<string>();
const PAYMENT_VERIFIED_KEY_PREFIX = "bookea-payment-verified-";

function clearPaymentParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("session_id");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

// DashboardPage: Panel principal del usuario con soporte offline y sección de lectura reciente
// Componente interno con toda la lógica del Dashboard
function DashboardContent() {
  const { userId } = useUserId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeSessionId = searchParams.get("session_id");
  const paymentStatus = searchParams.get("payment");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [isOnline, setIsOnline] = useState(true);
  const mounted = useIsClient();

  const queryClient = useQueryClient();

  // Tracking de analytics: visita a dashboard
  useEffect(() => {
    track('page_view', { page: 'dashboard' }).catch(console.warn);
  }, []);

  // Detectar éxito de pago y verificar (polling hasta que el webhook procese)
  useEffect(() => {
    if (paymentStatus !== "success" || !stripeSessionId) return;

    const verifiedKey = `${PAYMENT_VERIFIED_KEY_PREFIX}${stripeSessionId}`;
    if (sessionStorage.getItem(verifiedKey)) {
      clearPaymentParams();
      return;
    }

    if (!userId || paymentVerificationInFlight.has(stripeSessionId)) return;

    paymentVerificationInFlight.add(stripeSessionId);

    let attempts = 0;
    const maxAttempts = 15;
    const toastId = `stripe-payment-${stripeSessionId}`;

    const retryPaymentSync = () => {
      paymentVerificationInFlight.delete(stripeSessionId);
      window.location.reload();
    };

    const poll = async () => {
      if (attempts === 0) {
        toast.loading("Procesando tu pago...", { id: toastId });
      }

      try {
        const result = await verifySubscriptionAction(stripeSessionId) as PaymentVerificationResult;

        if (result.success) {
          if (result.type === "subscription") {
            toast.success("¡Bienvenido a Bookea Premium!", {
              id: toastId,
              description: "Tu suscripción se ha activado correctamente. Ya puedes disfrutar de todo el catálogo.",
              icon: <Sparkles className="w-5 h-5 text-amber-500" />,
              duration: 8000,
              action: {
                label: "Ir a mi biblioteca",
                onClick: () => router.push("/dashboard"),
              },
            });
          } else if (result.type === "payment" && result.items) {
            const hasPhysical = result.items.some((i) => i.includes("Físico"));
            toast.success("¡Compra completada!", {
              id: toastId,
              description: result.items.join(", "),
              duration: 6000,
              action: {
                label: hasPhysical ? "Ver mis órdenes" : "Ir a mi biblioteca",
                onClick: () => router.push(hasPhysical ? "/orders" : "/dashboard"),
              },
            });
          }

          useCartStore.getState().clearCart();
          queryClient.invalidateQueries({ queryKey: ["userBooks", userId] });
          sessionStorage.setItem(verifiedKey, "1");
          paymentVerificationInFlight.delete(stripeSessionId);
          clearPaymentParams();
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
          duration: 10000,
          action: {
            label: "Reintentar",
            onClick: retryPaymentSync,
          },
        });
      } catch {
        toast.error("Error de conexión", {
          id: toastId,
          duration: 10000,
          action: {
            label: "Reintentar",
            onClick: retryPaymentSync,
          },
        });
      }
    };

    poll();
  }, [paymentStatus, queryClient, router, stripeSessionId, userId]);

  // Detección de estado de conexión
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    queueMicrotask(handleStatus);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const effectiveUserId = mounted ? userId : "";
  const { data: allBooks, isLoading } = useUserBooks(effectiveUserId);

  const displayBooks = useMemo(() => {
    if (!mounted) return [];
    return allBooks || [];
  }, [allBooks, mounted]);

  const recentBook = useMemo(() => {
    if (!displayBooks || displayBooks.length === 0) return null;
    const sorted = [...displayBooks].sort((a, b) => {
      const timeA = new Date(a.last_read_at || 0).getTime();
      const timeB = new Date(b.last_read_at || 0).getTime();
      return timeB - timeA;
    });

    if (!isOnline) {
      return sorted.find((b) => b.isOfflineReady === true) || sorted[0];
    }
    return sorted[0];
  }, [displayBooks, isOnline]);

  const totalCompleted = useMemo(() => {
    return displayBooks?.filter((b) => (b.percent_complete || 0) >= 100).length ?? 0;
  }, [displayBooks]);

  const books = useMemo(() => {
    if (!displayBooks) return [];
    let filtered = [...displayBooks];
    if (!isOnline) filtered = filtered.filter((b) => b.isOfflineReady === true);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((b) =>
        b.title?.toLowerCase().includes(s) || b.author?.toLowerCase().includes(s)
      );
    }
    if (category && category !== "all") {
      filtered = filtered.filter((b) => b.category === category);
    }
    return filtered;
  }, [displayBooks, search, category, isOnline]);

  const categories = ["Ficción", "No Ficción", "Novela", "Clásicos", "Misterio y Suspenso", "Fantasía", "Ciencia Ficción", "Romance", "Terror", "Autoayuda", "Negocios y Finanzas", "Historia", "Biografías", "Cuentos", "Poesía", "Otros"];

  if (isLoading && isOnline && displayBooks.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f0eb] dark:bg-[#0a0a0a] p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-white">
      <PanelOnboarding />
      {!isOnline && (
        <div className="bg-orange-600/20 border-b border-orange-500/20 py-2 px-6 flex items-center justify-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
          <WifiOff className="w-3 h-3" /> Modo Offline Activado - Solo libros descargados disponibles
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12">
        {mounted && recentBook && (
          <Link href={`/reader/${recentBook.id}`} className="flex items-center gap-4 p-4 mb-6 bg-gray-100 dark:bg-zinc-800/50 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors">
            <div className="w-12 h-[72px] flex-shrink-0">
              <Book3D src={recentBook.cover_url || ""} title={recentBook.title} percentComplete={recentBook.percent_complete} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium mb-0.5">Continuar leyendo</div>
              <h3 className="text-sm font-semibold truncate">{recentBook.title}</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{recentBook.author}</p>
            </div>
            {recentBook.percent_complete !== undefined && (
              <ProgressCircle progress={recentBook.percent_complete} size={28} />
            )}
          </Link>
        )}

        <div className="flex items-center gap-4 mb-8">
          <Card className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <BookOpenCheck className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-lg font-black text-amber-400">{totalCompleted}</span>
              <span className="text-xs text-amber-700/60 dark:text-white/40 font-medium ml-1.5">leídos</span>
            </div>
          </Card>
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
              className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full transition-all flex items-center gap-2 uppercase tracking-widest"
            >
              Catálogo <Compass className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por título o autor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50 transition-shadow"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-sm text-gray-600 dark:text-zinc-400 font-medium focus:ring-2 focus:ring-blue-500/50 transition-shadow"
          >
            <option value="all">Género</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {mounted && (displayBooks.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-600 mb-4" />
            <p className="text-gray-400 dark:text-zinc-500 mb-4">No hay libros que mostrar</p>
            {isOnline && (
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all"
              >
                Explorar catálogo <Compass className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-5">
            {books.map((book) => (
              <BookLongPressMenu book={book} key={book.id}>
                <Card className="flex flex-col overflow-hidden group">
                  <Link href={`/reader/${book.id}`}>
                    <div className="aspect-[2/3] relative">
                      <Book3D src={book.cover_url || ""} title={book.title} percentComplete={book.percent_complete} />
                      {book.percent_complete !== undefined && (
                        <div className="absolute -bottom-2 -right-2 z-20 bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm border border-gray-200 dark:border-zinc-700">
                          <ProgressCircle progress={book.percent_complete} size={30} />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 text-center">
                    <h3 className="text-xs font-semibold truncate text-gray-900 dark:text-white">{book.title}</h3>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate">{book.author}</p>
                    {book.access_type && (
                      <div className="flex justify-center mt-1">
                        <AccessBadge accessType={book.access_type} />
                      </div>
                    )}
                  </div>
                </Card>
              </BookLongPressMenu>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}

// DashboardPage: Panel principal envuelto en Suspense para manejar useSearchParams en producción
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f0eb] dark:bg-[#0a0a0a] p-6"><DashboardSkeleton /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
