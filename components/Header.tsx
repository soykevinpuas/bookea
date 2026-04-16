"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useSubscription } from "@/hooks/useSubscription";
import { Zap } from "lucide-react";

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
  
  const supabase = useMemo(() => createClientClient(), []);
  const pathname = usePathname();
  const router = useRouter();

  // 6.1.1.1 - Obtención del estado de suscripción
  const { data: subscription } = useSubscription(user?.id);

  // 6.1.2a - Cuando el RSC del layout se re-ejecuta (por router.refresh()),
  // el prop `initialUser` cambia — este efecto lo sincroniza al state local.
  useEffect(() => {
    setUser(initialUser ?? null);
  }, [initialUser]);

  // 6.1.2b - Escucha cambios de sesión del lado del cliente (logout, etc.)
  // Se registra UNA sola vez. router.refresh() dispara el efecto de arriba.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        <Link 
          href="/" 
          className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 dark:text-white flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <span className="text-blue-600 dark:text-blue-500">B</span>ookea
        </Link>
        
        {/* 6.1.4.2 - Navegación principal */}
        <nav className="flex items-center gap-2 sm:gap-6">
          {isOnline && (
            <Link 
              href="/catalog" 
              className="text-[10px] sm:text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transform hover:-translate-y-0.5 hidden sm:block uppercase tracking-wider"
            >
              Catálogo
            </Link>
          )}
          
          {/* Toggle de tema claro/oscuro */}
          <ThemeToggle />

          {/* 6.1.4.3 - Menú de autenticación condicional */}
          {!isLoading && (
            user ? (
              // Usuario autenticado: mostrar créditos, avatar y menú de usuario
              <div className="flex items-center gap-3">
                <Link 
                  href="/subscribe"
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all text-[10px] sm:text-xs font-bold ${
                    subscription?.isActive 
                    ? (subscription?.role === 'admin' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400')
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <Zap className={`w-2.5 h-2.5 ${subscription?.isActive ? 'fill-current' : ''}`} />
                  {subscription?.role === 'admin' ? (
                    <span className="hidden xs:inline">Admin Permium</span>
                  ) : (
                    subscription?.isActive ? 'Premium' : 'Hazte Premium'
                  )}
                  {subscription?.role === 'admin' && <span className="xs:hidden">Admin</span>}
                </Link>
                <UserMenu email={user.email} />
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
                  className="text-sm font-medium bg-blue-600 dark:bg-blue-600/20 hover:bg-blue-700 dark:hover:bg-blue-600/30 text-white dark:text-blue-400 dark:border dark:border-blue-500/30 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all shadow-sm cursor-pointer"
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
