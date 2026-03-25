"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

// ============================================
// 6.1 - Header: Barra de navegación global de la aplicación
// Muestra logo, navegación principal, tema y autenticación
// ============================================

interface HeaderProps {
  initialUser?: { id: string; email?: string } | null;
}

// 6.1.1 - Componente Header con autenticación en tiempo real
export function Header({ initialUser = null }: HeaderProps) {
  // Estado local del usuario y estado de carga
  const [user, setUser] = useState<{ id: string; email?: string } | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  
  // Memoización del cliente Supabase para evitar recreaciones innecesarias
  const supabase = useMemo(() => createClientClient(), []);
  const pathname = usePathname();

  // 6.1.2 - Efecto para sincronizar estado de autenticación con Supabase
  useEffect(() => {
    let mounted = true;
    
    // Sincronizar con initialUser si cambia (ej. navegación entre páginas)
    if (initialUser && !user) {
        setUser(initialUser);
        setIsLoading(false);
    }

    // Paso 1: Obtener sesión inicial (método más rápido para cliente)
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
        }
      } catch (err) {
        console.error("Header Auth Init Error:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    
    initAuth();

    // Paso 2: Escuchar eventos de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      }
    );

    // Cleanup: Desmontar listener al destruir componente
    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [supabase]);

  // 6.1.3 - Ocultar Header en la vista del lector para máxima inmersión
  if (pathname?.startsWith("/reader")) {
    return null;
  }

  // ============================================
  // 6.1.4 - Renderizado del Header
  // ============================================
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-black/60 retro:bg-[#0d1117]/90 border-b border-gray-200 dark:border-white/10 retro:border-[#3fb950]/20 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all pt-safe">
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
              // Usuario autenticado: mostrar avatar y menú de usuario
              <UserMenu email={user.email} />
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
