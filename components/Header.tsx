"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useCredits } from "@/hooks/useCredits";
import { Ticket } from "lucide-react";

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
  
  const supabase = useMemo(() => createClientClient(), []);
  const pathname = usePathname();
  const router = useRouter();

  // 6.1.1.1 - Obtención de créditos
  const { credits } = useCredits(user?.id);

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
          className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-blue-600 dark:text-blue-500">B</span>ookea
        </Link>
        
        {/* 6.1.4.2 - Navegación principal */}
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link 
            href="/catalog" 
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors hidden sm:block"
          >
            Catálogo
          </Link>
          
          {/* Toggle de tema claro/oscuro */}
          <ThemeToggle />

          {/* 6.1.4.3 - Menú de autenticación condicional */}
          {!isLoading && (
            user ? (
              // Usuario autenticado: mostrar créditos, avatar y menú de usuario
              <div className="flex items-center gap-3">
                <Link 
                  href="/subscribe"
                  className="hidden xs:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all"
                >
                  <Ticket className="w-3 h-3 fill-current" />
                  {credits ?? 0} { (credits === 1) ? 'Crédito' : 'Créditos' }
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
