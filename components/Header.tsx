"use client";

import Link from "next/link";
import { PrefetchLink } from "@/components/ui/LoadingStates";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo, useTransition, useRef } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useAvatars";
import { useCoins } from "@/hooks/useCoins";
import { Zap, Loader2, Coins, Circle, ShoppingCart, BookOpen, WifiOff } from "lucide-react";
import { parseAvatarConfig } from "@/lib/avatars-v2";
import { AnimalEngine } from "./avatars/AnimalEngine";
import { CoinBalanceDisplay } from "@/components/ui/CoinBalance";
import { useCartStore } from "@/stores/cart";

// ============================================
// 6.1 - Header: Barra de navegación global de la aplicación
// Muestra logo, navegación principal, tema y autenticación
// ============================================

interface HeaderProps {
  initialUser?: { id: string; email?: string } | null;
}

  // 6.1.1 - Componente Header con autenticación en tiempo real
export function Header({ initialUser = null }: HeaderProps) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showCoins, setShowCoins] = useState(false);
  const coinsRef = useRef<HTMLDivElement>(null);
  
  const supabase = useMemo(() => createClientClient(), []);
  const pathname = usePathname();
  const router = useRouter();

  // 6.1.1.1 - Obtención del estado de suscripción
  const { data: subscription } = useSubscription(user?.id);
  const { profile } = useProfile(user?.id);
  const { data: coinsBalance } = useCoins(user?.id);
  const cartItems = useCartStore((s) => s.items);
  const toggleCart = useCartStore((s) => s.toggleCart);
  const toggleLibrary = useCartStore((s) => s.toggleLibrary);

  // 6.1.2a - Cuando el RSC del layout se re-ejecuta (por router.refresh()),
  // el prop `initialUser` cambia — este efecto lo sincroniza al state local.
  useEffect(() => {
    setUser(initialUser ?? null);
  }, [initialUser]);

  // 6.1.2b - Escucha cambios de sesión del lado del cliente (logout, etc.)
  // Se registra UNA sola vez. router.refresh() dispara el efecto de arriba.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // 6.1.2c - Detectar estado de conexión
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

  // 6.1.2d - Cerrar dropdown de monedas al hacer clic fuera
  useEffect(() => {
    if (!showCoins) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (coinsRef.current && !coinsRef.current.contains(e.target as Node)) {
        setShowCoins(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCoins]);

  // 6.1.3 - Ocultar Header en la vista del lector para máxima inmersión
  if (pathname?.startsWith("/reader")) {
    return null;
  }

  // ============================================
  // 6.1.4 - Renderizado del Header
  // ============================================
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-gray-100/90 dark:bg-black/60 retro:bg-[#0d1117]/90 border-b border-gray-200 dark:border-white/10 retro:border-[#3fb950]/20 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* 6.1.4.1 - Logo de Bookea con enlace al inicio */}
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 dark:text-white flex items-center gap-0 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <span className={subscription?.isActive ? "text-amber-500" : "text-blue-600 dark:text-blue-500"}>B</span>ookea
          </Link>
          {!isOnline && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
        </div>
        
        {/* 6.1.4.2 - Navegación principal */}
          <nav className="flex items-center gap-2 sm:gap-6">
            {isOnline && (
              <PrefetchLink 
                href="/catalog"
                className={`text-[10px] sm:text-xs font-black px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all shadow-sm transform hover:-translate-y-0.5 hidden sm:block uppercase tracking-wider border ${
                  subscription?.isActive 
                  ? "bg-white dark:bg-[#151515] border-gray-200 dark:border-white/5 text-gray-900 dark:text-white"
                  : "bg-blue-600 hover:bg-blue-500 border-transparent text-white"
                }`}
              >
                Catálogo
              </PrefetchLink>
            )}

            {user && (
              <Link
                href="/dashboard"
                className="text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-full transition-all uppercase tracking-wider hidden sm:block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Mi Biblioteca
              </Link>
            )}
           
           {/* Toggle de tema claro/oscuro */}
           <ThemeToggle />

          {/* 6.1.4.3 - Menú de autenticación condicional */}
           {!isLoading && (
             user ? (
                // Usuario autenticado: mostrar carrito, monedas, premium, avatar y menú de usuario
                <div className="flex items-center gap-3">
                  {/* Botón de biblioteca rápida */}
                  <button
                    onClick={toggleLibrary}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    aria-label="Biblioteca"
                    title="Biblioteca rápida"
                  >
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Botón de carrito */}
                  <button
                    onClick={toggleCart}
                    className="relative p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    aria-label="Carrito"
                  >
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    {cartItems.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-blue-600 text-white text-[8px] sm:text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                        {cartItems.length}
                      </span>
                    )}
                  </button>
                  {/* Botón de monedas con dropdown */}
                 <div className="relative" ref={coinsRef}>
                   <button
                     onClick={() => setShowCoins(!showCoins)}
                     className="flex items-center gap-1 px-2 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-all text-xs font-bold hover:bg-amber-500/20"
                   >
                     <Circle className="w-3 h-3 fill-current" />
                     {coinsBalance && (
                       <span>{(coinsBalance.bronze || 0) + (coinsBalance.silver || 0) + (coinsBalance.gold || 0) + (coinsBalance.diamond || 0)}</span>
                     )}
                   </button>

                   {/* Dropdown vertical debajo del botón */}
                   {showCoins && coinsBalance && (
                     <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50">
                       <CoinBalanceDisplay balance={coinsBalance} variant="full" />
                     </div>
                   )}
                 </div>

                 <Link
                  href="/subscribe"
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all text-[10px] sm:text-xs font-black ${
                    subscription?.isActive 
                    ? (subscription?.role === 'admin' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500')
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <Zap className={`w-2.5 h-2.5 ${subscription?.isActive ? 'fill-current' : ''}`} />
                  {subscription?.role === 'admin' ? (
                    <span className="hidden xs:inline">Premium Admin</span>
                  ) : (
                    subscription?.isActive ? 'Premium' : 'Hazte Premium'
                  )}
                  {subscription?.role === 'admin' && <span className="xs:hidden">Admin</span>}
                </Link>
                <UserMenu email={user.email} avatarConfig={profile?.avatar_url} />
              </div>
            ) : (
              // Usuario no autenticado: mostrar botones de login/registro
              <div className="flex items-center gap-3 sm:gap-4">
                <Link 
                  href="/login" 
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:block"
                >
                  Iniciar
                </Link>
                <Link 
                  href="/register" 
                  className="text-sm font-bold bg-gray-900 dark:bg-white hover:opacity-90 text-white dark:text-black px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  Regístrate
                </Link>
              </div>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
