"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  ChevronRight,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/books", label: "Libros", icon: BookOpen },
  { href: "/admin/orders", label: "Órdenes", icon: ShoppingCart },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/inventory", label: "Inventario", icon: Package },
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

  const handleLogout = async () => {
    const supabase = createClientClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 pb-4 bg-[#111111] border-b border-white/5 sticky top-0 z-50 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">B</div>
          <span className="font-bold tracking-tight">Admin</span>
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-white/60 hover:text-white bg-white/5 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile Only) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar aside */}
      <aside className={`
        fixed md:sticky top-0 left-0 bottom-0 z-50 w-64 h-screen bg-[#111111] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="px-6 py-8 border-b border-white/5 hidden md:block">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-500/20">B</div>
            <div>
              <p className="font-bold text-lg leading-tight tracking-tight">Bookea</p>
              <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Admin Panel</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
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

        <div className="p-4 border-t border-white/5 space-y-2 bg-[#0d0d0d]/50 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
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
      <main className="flex-1 w-full min-h-screen overflow-x-hidden">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
