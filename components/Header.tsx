"use client";

import Link from "next/link";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function Header() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientClient();

  useEffect(() => {
    // 1. Fetch initial session
    const getInitialSession = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setIsLoading(false);
    };
    getInitialSession();

    // 2. Listen to active auth events (login/logout/register) realtime
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-black/60 border-b border-gray-200 dark:border-white/10 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link 
          href="/" 
          className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-blue-600 dark:text-blue-500">B</span>ookea
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link 
            href="/catalog" 
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors hidden sm:block"
          >
            Catálogo
          </Link>
          
          <ThemeToggle />

          {!isLoading && (
            user ? (
              <UserMenu email={user.email} />
            ) : (
              <div className="flex items-center gap-3 sm:gap-4">
                <Link 
                  href="/login" 
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:block"
                >
                  Ingresar
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
