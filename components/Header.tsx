"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ThemeToggle } from "./ThemeToggle";
import { useSubscription } from "@/hooks/useSubscription";
import { Menu, WifiOff } from "lucide-react";
import { useMobileMenu } from "@/stores/menu";

const UserMenu = dynamic(() => import("./UserMenu").then(m => m.UserMenu));

export function Header() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  const supabase = useMemo(() => createClientClient(), []);
  const pathname = usePathname();
  const router = useRouter();

  const { data: subscription } = useSubscription(user?.id);
  const { open: menuOpen, setOpen: setMenuOpen } = useMobileMenu();

  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) setUser(user);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [supabase]);

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add("mobile-menu-open");
    } else {
      document.body.classList.remove("mobile-menu-open");
    }
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

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

  if (pathname?.startsWith("/reader") || pathname === "/") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-gray-100/90 dark:bg-black/60 retro:bg-[#0d1117]/90 border-b border-gray-200 dark:border-white/10 retro:border-[#3fb950]/20 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-2 -ml-1 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white bg-gray-200/50 dark:bg-white/5 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link
            href="/"
            className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 dark:text-white flex items-center gap-0 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <span className={mounted && subscription?.isActive ? "text-amber-500" : "text-blue-600 dark:text-blue-500"}>B</span>ookea
          </Link>
          {!isOnline && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
        </div>

        <nav className="flex items-center gap-3">
          <ThemeToggle />

          {!isLoading && (
            user ? (
              <UserMenu email={user.email} userId={user.id} />
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Iniciar
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-bold bg-gray-900 dark:bg-white hover:opacity-90 text-white dark:text-black px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all shadow-sm"
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
