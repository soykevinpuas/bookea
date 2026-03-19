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

  useEffect(() => {
    const supabase = createClientClient();

    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const authUser = sessionData.session.user;

      // Use SECURITY DEFINER RPC to bypass RLS circular dependency on public.users
      const { data: roleData, error: rpcError } = await supabase.rpc("get_my_role");

      if (rpcError) {
        console.error("Admin: get_my_role RPC error:", rpcError.message);
        router.push("/dashboard");
        return;
      }

      const userRole = roleData as string | null;

      if (userRole !== "admin") {
        console.warn("Admin: role is", userRole, "– not admin, redirecting");
        router.push("/dashboard");
        return;
      }

      setUser({ email: authUser.email, role: userRole });
      setLoading(false);
    };

    checkAdmin();
  }, []);

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
    <div className="min-h-screen bg-[#0d0d0d] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-[#111111] border-r border-white/5 flex flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">B</div>
            <span className="font-bold text-lg tracking-tight">Bookea</span>
            <span className="ml-auto text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">ADMIN</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-white/30" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer user info */}
        <div className="px-3 py-4 border-t border-white/5 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Ver sitio
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
          <div className="px-3 pt-2 pb-1">
            <p className="text-[11px] text-white/25 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Main content — offset by sidebar width */}
      <div className="ml-64 flex-1 min-h-screen">
        <main className="p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
