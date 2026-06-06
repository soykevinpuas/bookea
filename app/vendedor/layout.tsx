"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  LogOut,
  ExternalLink,
  Menu,
  Store,
  X,
} from "lucide-react";
import { useUserId } from "@/hooks/useUser";

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
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const { userId } = useUserId();

  useEffect(() => {
    const supabase = createClientClient();

    const checkVendedor = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const { data: roleData } = await supabase.rpc("get_my_role");

      if ((roleData as string) !== "vendedor" && (roleData as string) !== "admin") {
        router.push("/dashboard");
        return;
      }

      setUser({ email: sessionData.session.user.email, role: roleData as string });
      setLoading(false);
    };

    checkVendedor();
  }, [router]);



  const handleLogout = async () => {
    const supabase = createClientClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0d0d0d] retro:bg-[#0d1117] navy:bg-[#0a0f1e]">
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-white/20 border-t-amber-600 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] retro:bg-[#0d1117] navy:bg-[#0a0f1e] text-gray-900 dark:text-white retro:text-white navy:text-[#e8eaf6] flex flex-col md:flex-row vendedor-theme-container">


      {/* Sidebar - Desktop only */}
      <aside className="hidden md:flex sticky top-0 left-0 bottom-0 z-50 w-64 bg-[#111111] border-r border-white/5 flex-col overflow-y-auto">
        <div className="px-6 py-8 border-b border-white/5">
          <Link href="/vendedor" className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg ${
              user?.role === "admin"
                ? "bg-blue-600 shadow-blue-500/20"
                : "bg-amber-600 shadow-amber-500/20"
            }`}>
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight tracking-tight text-white">Bookea</p>
              <p className={`text-[10px] font-bold tracking-widest uppercase ${
                user?.role === "admin" ? "text-blue-400" : "text-amber-400"
              }`}>
                {user?.role === "admin" ? "Admin-Vendedor" : "Vendedor"}
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
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-white/40"}`} />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-amber-400/50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2 bg-[#0d0d0d]/50">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Ver catálogo
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

      {/* Main Content */}
      <main className="flex-1 w-full min-h-screen relative">
        <div className="p-4 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
