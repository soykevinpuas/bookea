"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { recoverBrowserSession } from "@/lib/auth-fetch";
import { useEffect } from "react";
import { toast } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuth } from "@/lib/auth-provider";
import { useSubscription } from "@/hooks/useSubscription";
import {
  BookOpen,
  Shield,
  ShoppingCart,
  Users,
  Store,
  ChevronRight,
  LogOut,
  ExternalLink,
  X,
  RefreshCw,
} from "lucide-react";
import { useMobileMenu } from "@/stores/menu";

const navItems = [
  { href: "/admin", label: "Admin", icon: Shield, exact: true },
  { href: "/admin/books", label: "Libros", icon: BookOpen },
  { href: "/admin/orders", label: "Órdenes", icon: ShoppingCart },
  { href: "/admin/vendedores", label: "Vendedores", icon: Store },
  { href: "/admin/users", label: "Usuarios", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { open: isMobileMenuOpen, setOpen: setMobileMenuOpen } = useMobileMenu();
  const { userId, email, isLoading: authLoading } = useAuth();
  const { data: subscription, isFetched } = useSubscription(userId);
  const role = subscription?.role;
  const roleKnown = !!subscription;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      const supabase = createClientClient();
      void recoverBrowserSession(supabase).then((recovered) => {
        if (!recovered) router.push("/login");
      });
      return;
    }
    if (!isFetched && !roleKnown) return;
    if (!roleKnown) return;
    if (role === "vendedor") {
      router.push("/vendedor");
    } else if (role !== "admin") {
      router.push("/dashboard");
    }
  }, [authLoading, isFetched, role, roleKnown, router, userId]);

  const handleLogout = async () => {
    const supabase = createClientClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

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
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-500/20">B</div>
            <div>
              <p className="font-bold text-lg leading-tight tracking-tight text-gray-900 dark:text-white">Bookea</p>
              <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Admin</p>
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
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/10 shadow-sm"
                    : "text-gray-500 dark:text-white/40 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-gray-500 dark:text-white/40"}`} />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-blue-400/50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-2 bg-gray-50/50 dark:bg-[#0d0d0d]/50">
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/authors/seed', { method: 'POST' });
                const data = await res.json();
                if (data.error) { toast.error(data.error); return; }
                toast.success(`Actualizados: ${data.updated}, Saltados: ${data.skipped}, Fallaron: ${data.failed}`);
              } catch { toast.error('Error de conexión'); }
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Auto-llenar autores
          </button>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Ver sitio público
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

      {/* Main Content Area */}
      <div className="flex-1 w-full min-h-screen">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
