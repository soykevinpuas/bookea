"use client";

import { User, LogOut, Shield, Zap, BookOpen, ShoppingCart, Circle, Package } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createClientClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserId } from "@/hooks/useUser";
import { useProfile } from "@/hooks/useAvatars";
import { useCoins } from "@/hooks/useCoins";
import { useCartStore } from "@/stores/cart";
import { AnimalEngine } from "./avatars/AnimalEngine";
import { parseAvatarConfig } from "@/lib/avatars-v2";

export function UserMenu({ email }: { email?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClientClient();

  const { userId } = useUserId();
  const { data: subscription } = useSubscription(userId);
  const { profile } = useProfile(userId);
  const { data: coinsBalance } = useCoins(userId);
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
    await supabase.auth.signOut();
    router.refresh();
  };

  const isPremium = subscription?.isActive;
  const totalCoins = coinsBalance
    ? (coinsBalance.bronze || 0) + (coinsBalance.silver || 0) + (coinsBalance.gold || 0) + (coinsBalance.diamond || 0)
    : 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
      >
        <div className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden flex items-center justify-center relative">
           {profile?.avatar_url ? (
              <AnimalEngine
               config={parseAvatarConfig(profile.avatar_url)}
               size="100%"
              />
           ) : (
            <span className="text-sm font-bold uppercase text-gray-400">
              {email?.charAt(0) || "U"}
            </span>
          )}

          {isPremium && (
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white dark:border-black" />
          )}
        </div>
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
              {subscription?.role === 'vendedor' && (
                <Link href="/vendedor" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                  Vendedor
                </Link>
              )}
              {subscription?.role === 'admin' && (
                <Link href="/admin" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="p-2 space-y-0.5">
            <MenuItem href="/catalog" icon={<BookOpen className="w-4 h-4" />} label="Catálogo" onClick={() => setIsOpen(false)} />
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
            {totalCoins > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-white/60">
                <span className="flex items-center gap-3">
                  <Circle className="w-4 h-4 text-amber-500 fill-current" />
                  Monedas
                </span>
                <span className="text-[11px] text-amber-500 font-black">{totalCoins}</span>
              </div>
            )}
          </div>

          {/* Subscription / Role links */}
          {(subscription?.role === 'vendedor' || subscription?.role === 'admin' || !isPremium) && (
            <div className="border-t border-gray-100 dark:border-white/5 p-2 space-y-0.5">
              {!isPremium && (
                <MenuItem
                  href="/subscribe"
                  icon={<Zap className="w-4 h-4 fill-current text-blue-500" />}
                  label="Hazte Premium"
                  className="text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                  onClick={() => setIsOpen(false)}
                />
              )}
              {subscription?.role === 'vendedor' && (
                <MenuItem
                  href="/vendedor"
                  icon={<Shield className="w-4 h-4 text-amber-500" />}
                  label="Panel Vendedor"
                  className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setIsOpen(false)}
                />
              )}
              {subscription?.role === 'admin' && (
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
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all group"
            >
              <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, icon, label, className = "", onClick }: { href: string; icon: React.ReactNode; label: string; className?: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group ${className}`}
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      {label}
    </Link>
  );
}
