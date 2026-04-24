"use client";

import { User, LogOut, Shield, Zap, LayoutDashboard } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createClientClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserId } from "@/hooks/useUser";
import { AnimalEngine } from "./avatars/AnimalEngine";
import { parseAvatarConfig } from "@/lib/avatars-v2";

/**
 * 6.2 - UserMenu: Menú desplegable para la gestión de cuenta del usuario
 * Muestra opciones de perfil, escritorio, admin y logout
 */

interface UserMenuProps {
  email?: string;
  avatarConfig?: string | null;
}

export function UserMenu({ email, avatarConfig }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClientClient();

  const { userId } = useUserId();
  const { data: subscription } = useSubscription(userId);

  // 6.2.1 - Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const isPremium = subscription?.isActive;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
      >
        <div className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden flex items-center justify-center relative">
          {avatarConfig ? (
             <AnimalEngine 
              type={parseAvatarConfig(avatarConfig).type} 
              color={parseAvatarConfig(avatarConfig).color} 
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
        <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[100]">
          <div className="p-4 border-b border-gray-100 dark:border-white/5">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-white/20 mb-1">Cuenta</p>
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{email}</p>
          </div>

          <div className="p-2 space-y-1">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group"
            >
              <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Ver Perfil
            </Link>

            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group"
            >
              <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Escritorio
            </Link>

            {!isPremium && (
              <Link
                href="/subscribe"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-black text-blue-600 dark:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all group"
              >
                <Zap className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                Hazte Premium
              </Link>
            )}

            {subscription?.role === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-black text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all group"
              >
                <Shield className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Panel Admin
              </Link>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 dark:border-white/5">
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
