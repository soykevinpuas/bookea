"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Shield,
  ShoppingCart,
  Users,
  Store,
  ChevronRight,
  LogOut,
  ExternalLink,
  Menu,
  X,
  RefreshCw,
} from "lucide-react";

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
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClientClient();

    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const authUser = sessionData.session.user;
      const { data: roleData, error: rpcError } = await supabase.rpc("get_my_role");

      if (rpcError || (roleData as string) !== "admin") {
        router.push("/dashboard");
        return;
      }

      setUser({ email: authUser.email, role: roleData as string });
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Manejar clase de menú abierto en body para el stacking context en móvil
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add("mobile-menu-open");
    } else {
      document.body.classList.remove("mobile-menu-open");
    }
    return () => {
      document.body.classList.remove("mobile-menu-open");
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    const supabase = createClientClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0d0d0d] retro:bg-[#0d1117] navy:bg-[#0a0f1e]">
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-white/20 border-t-blue-600 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] retro:bg-[#0d1117] navy:bg-[#0a0f1e] text-gray-900 dark:text-white retro:text-white navy:text-[#e8eaf6] flex flex-col md:flex-row admin-theme-container">
      {/* Sidebar Overlay (Mobile Only) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[55] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar aside */}
      <aside className={`
        fixed md:sticky top-0 left-0 bottom-0 z-[70] w-64 bg-[#111111] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out
        overflow-y-auto md:overflow-y-visible
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        pb-[max(5rem,env(safe-area-inset-bottom))] md:pb-0
      `}>
        <div className="md:hidden flex items-center justify-end px-4 pt-[max(env(safe-area-inset-top,16px),16px)] pb-2">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 text-gray-400 dark:text-white/45 hover:text-gray-950 dark:hover:text-white bg-gray-100 dark:bg-white/5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-8 border-b border-white/5 hidden md:block">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-500/20">B</div>
            <div>
              <p className="font-bold text-lg leading-tight tracking-tight text-white">Bookea</p>
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
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-white/40"}`} />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-blue-400/50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2 bg-[#0d0d0d]/50">
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/authors/seed', { method: 'POST' });
                const data = await res.json();
                if (data.error) { toast.error(data.error); return; }
                toast.success(`Actualizados: ${data.updated}, Saltados: ${data.skipped}, Fallaron: ${data.failed}`);
              } catch { toast.error('Error de conexión'); }
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Auto-llenar autores
          </button>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Ver sitio público
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
          
          <div className="mt-4 px-4 py-3 bg-white/5 rounded-xl border border-white/5 overflow-hidden">
            <p className="text-[10px] text-white/20 font-bold uppercase tracking-wider mb-1">Sesión Activa</p>
            <p className="text-[11px] text-white/60 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full min-h-screen relative">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden absolute top-4 left-4 z-[65] text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
