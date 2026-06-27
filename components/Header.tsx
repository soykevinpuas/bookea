"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ThemeToggle } from "./ThemeToggle";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/auth-provider";
import { Menu, WifiOff } from "lucide-react";
import { useMobileMenu } from "@/stores/menu";

const UserMenu = dynamic(() => import("./UserMenu").then(m => m.UserMenu), {
  loading: () => <div className="w-20 h-8 bg-gray-200 dark:bg-white/10 rounded-full animate-pulse" />,
});

export function Header() {
  const { userId, email } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  const pathname = usePathname();

  const { data: subscription } = useSubscription(userId);
  const { open: menuOpen, setOpen: setMenuOpen } = useMobileMenu();

  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (pathname?.startsWith("/reader") || pathname === "/" || pathname?.startsWith("/login") || pathname?.startsWith("/register") || pathname?.startsWith("/subscribe")) {
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

          {userId && <UserMenu email={email} userId={userId} />}
        </nav>
      </div>
    </header>
  );
}
