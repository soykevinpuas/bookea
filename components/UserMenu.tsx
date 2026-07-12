"use client";

import { User, LogOut, Shield, Zap, BookOpen, ShoppingCart, Package, Store } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createClientClient } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserId } from "@/hooks/useUser";
import { useProfile } from "@/hooks/useAvatars";
import { useIsClient } from "@/hooks/useIsClient";

import { useCartStore } from "@/stores/cart";
import { AvatarBadge } from "@/components/profile/AvatarBadge";

export function UserMenu({ email, userId: propUserId }: { email?: string; userId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useIsClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClientClient();

  const { userId } = useUserId();
  const resolvedUserId = propUserId || userId;
  const { data: subscription, isLoading: roleLoading } = useSubscription(resolvedUserId);
  const { profile } = useProfile(resolvedUserId);
  const cartItems = useCartStore((s) => s.items);
  const toggleCart = useCartStore((s) => s.toggleCart);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as EventListener);
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.refresh();
  };

  const role = subscription?.role;
  const roleKnown = !!subscription;
  const isPremium = !!subscription?.isActive;
  const showPremiumLink = roleKnown && !isPremium && role !== "vendedor" && role !== "admin";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
      >
        <AvatarBadge
          avatarUrl={profile?.avatar_url}
          fallbackText={profile?.name || email || "U"}
          premium={mounted && isPremium}
          className="w-8 h-8"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[100]">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {isPremium && (
                <span className="text-[10px] font-bold text-amber-500">Premium</span>
              )}
              {roleLoading && !roleKnown && (
                <span className="text-[10px] font-bold text-gray-400 dark:text-white/30">Verificando rol...</span>
              )}
              {role === 'vendedor' && (
                <Link href="/vendedor" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                  Vendedor
                </Link>
              )}
              {role === 'admin' && (
                <Link href="/admin" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="p-2 space-y-0.5">
            <MenuItem href="/catalog" icon={<BookOpen className="w-4 h-4" />} label="Catálogo" onClick={() => setIsOpen(false)} />
            {(role === 'vendedor' || role === 'admin') && mounted && (
              <MenuItem href="/vendedor" icon={<Store className="w-4 h-4" />} label="Tienda" onClick={() => setIsOpen(false)} />
            )}
            <MenuItem href="/orders" icon={<Package className="w-4 h-4" />} label="Mis Órdenes" onClick={() => setIsOpen(false)} />
            <button
              onClick={() => { toggleCart(); setIsOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group"
            >
              <span className="flex items-center gap-3">
                <ShoppingCart className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Carrito
              </span>
              {cartItems.length > 0 && (
                <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Account */}
          <div className="border-t border-gray-100 dark:border-white/5 p-2 space-y-0.5">
            <MenuItem href="/profile" icon={<User className="w-4 h-4" />} label="Perfil" onClick={() => setIsOpen(false)} />
          </div>

          {/* Subscription / Role links */}
          {(role === 'vendedor' || role === 'admin' || showPremiumLink) && (
            <div className="border-t border-gray-100 dark:border-white/5 p-2 space-y-0.5">
              {showPremiumLink && (
                <MenuItem
                  href="/subscribe"
                  icon={<Zap className="w-4 h-4 fill-current text-blue-500" />}
                  label="Hazte Premium"
                  className="text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                  onClick={() => setIsOpen(false)}
                />
              )}
              {role === 'vendedor' && (
                <MenuItem
                  href="/vendedor"
                  icon={<Shield className="w-4 h-4 text-amber-500" />}
                  label="Panel Vendedor"
                  className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setIsOpen(false)}
                />
              )}
              {role === 'admin' && (
                <MenuItem
                  href="/admin"
                  icon={<Shield className="w-4 h-4 text-purple-500" />}
                  label="Panel Admin"
                  className="text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                  onClick={() => setIsOpen(false)}
                />
              )}
            </div>
          )}

          {/* Logout */}
          <div className="border-t border-gray-100 dark:border-white/5 p-2">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all group disabled:opacity-50 disabled:pointer-events-none"
          >
            {loggingOut ? (
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
            {loggingOut ? "Cerrando..." : "Cerrar Sesión"}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, icon, label, className = "", onClick }: { href: string; icon: React.ReactNode; label: string; className?: string; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl transition-all group ${
        isActive
          ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-white/10"
          : "text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
      } ${className}`}
    >
      <span className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
      {label}
    </Link>
  );
}
