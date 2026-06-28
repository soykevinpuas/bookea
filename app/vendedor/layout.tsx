"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import {
  ChevronRight,
  LogOut,
  ExternalLink,
  Store,
  X,
} from "lucide-react";
import { useUserId } from "@/hooks/useUser";
import { useAuth } from "@/lib/auth-provider";
import { useSubscription } from "@/hooks/useSubscription";
import { useMobileMenu } from "@/stores/menu";
import { createClientClient } from "@/lib/supabase";

const navItems = [
  { href: "/vendedor", label: "Mi Tienda", icon: Store, exact: true },
];

export default function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId, isLoading: authLoading } = useUserId();
  const { email } = useAuth();
  const { data: subscription, isFetched } = useSubscription(userId);
  const { open: isMobileMenuOpen, setOpen: setMobileMenuOpen } = useMobileMenu();
  const role = subscription?.role;
  const roleKnown = !!subscription;
  const hasSellerAccess = role === "vendedor" || role === "admin";

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      router.push("/login");
      return;
    }
    if (!isFetched && !roleKnown) return;
    if (roleKnown && !hasSellerAccess) {
      router.push("/dashboard");
    }
  }, [authLoading, hasSellerAccess, isFetched, roleKnown, userId, router]);

  const handleLogout = useCallback(async () => {
    const s = createClientClient();
    await s.auth.signOut();
    router.push("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] retro:bg-[#0d1117] navy:bg-[#0a0f1e] text-gray-900 dark:text-white retro:text-white navy:text-[#e8eaf6] flex flex-col md:flex-row">
      {/* Sidebar Overlay (Mobile Only) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[55] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 bottom-0 z-[70] w-64 bg-gray-100 dark:bg-[#111111] border-r border-gray-200 dark:border-white/5 flex flex-col transition-transform duration-300 ease-in-out
        overflow-y-auto md:overflow-y-visible
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        pb-[max(5rem,env(safe-area-inset-bottom))] md:pb-0
      `}>
        <div className="md:hidden flex items-center justify-end px-4 pt-[max(env(safe-area-inset-top,16px),16px)] pb-2">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-gray-400 dark:text-white/45 hover:text-gray-950 dark:hover:text-white bg-gray-100 dark:bg-white/5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-8 border-b border-gray-200 dark:border-white/5 hidden md:block">
          <Link href="/vendedor" className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg ${
              role === "admin"
                ? "bg-blue-600 shadow-blue-500/20"
                : "bg-amber-600 shadow-amber-500/20"
            }`}>
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight tracking-tight text-gray-900 dark:text-white">Bookea</p>
              <p className={`text-[10px] font-bold tracking-widest uppercase ${
                role === "admin" ? "text-blue-400" : "text-amber-400"
              }`}>
                {role === "admin" ? "Admin-Vendedor" : "Vendedor"}
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-visible md:overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-amber-600/10 text-amber-400 border border-amber-500/10 shadow-sm"
                    : "text-gray-500 dark:text-white/40 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-gray-500 dark:text-white/40"}`} />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-amber-400/50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-2 bg-gray-50/50 dark:bg-[#0d0d0d]/50">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Ver catálogo
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>

          <div className="mt-4 px-4 py-3 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
            <p className="text-[10px] text-gray-400 dark:text-white/20 font-bold uppercase tracking-wider mb-1">Sesión Activa</p>
            <p className="text-[11px] text-gray-600 dark:text-white/60 truncate">{email}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 w-full min-h-screen">
        <div className="p-4 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}
