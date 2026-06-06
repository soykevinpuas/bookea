"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  ChevronRight,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Store,
} from "lucide-react";
import { useProfile } from "@/hooks/useAvatars";
import { useUserId } from "@/hooks/useUser";
import { parseAvatarConfig } from "@/lib/avatars-v2";
import { AnimalEngine } from "@/components/avatars/AnimalEngine";

const navItems = [
  { href: "/vendedor", label: "Mi Tienda", icon: Store, exact: true },
  { href: "/vendedor/solicitudes/nueva", label: "Solicitar Stock", icon: ShoppingCart },
  { href: "/vendedor/solicitudes", label: "Mis Solicitudes", icon: ShoppingCart },
];

export default function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { userId } = useUserId();
  const { profile } = useProfile(userId);

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

      setUser({ email: sessionData.session.user.email });
      setLoading(false);
    };

    checkVendedor();
  }, [router]);

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
        <Link href="/vendedor" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <AnimalEngine config={parseAvatarConfig(profile.avatar_url)} size="100%" />
            ) : (
              <span className="text-sm font-bold text-white/40">V</span>
            )}
          </div>
          <span className="font-bold tracking-tight">Vendedor</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-white/60 hover:text-white bg-white/5 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 bottom-0 z-50 w-64 h-screen bg-[#111111] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          pt-[max(1rem,env(safe-area-inset-top))] md:pt-0 pb-[max(5rem,env(safe-area-inset-bottom))] md:pb-0
        `}
      >
        <div className="px-6 py-8 border-b border-white/5 hidden md:block">
          <Link href="/vendedor" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-amber-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight tracking-tight">Bookea</p>
              <p className="text-[10px] text-amber-400 font-bold tracking-widest uppercase">Vendedor</p>
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
      <main className="flex-1 w-full min-h-screen">
        <div className="p-4 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
