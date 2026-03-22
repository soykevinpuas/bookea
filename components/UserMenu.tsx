"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { User, LogOut, BookOpen, ChevronDown, Zap, Shield, CreditCard } from "lucide-react";
import Link from "next/link";
import { createClientClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UserMenuProps {
  email: string | undefined;
}

export function UserMenu({ email }: UserMenuProps) {
  const router = useRouter();
  const supabase = createClientClient();
  const [role, setRole] = useState<string>("free");

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        if (data?.role) setRole(data.role);
      }
    }
    getRole();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isSubscriber = role === 'subscriber';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Menú de usuario"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shadow-sm">
            {email ? email.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-1" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[240px] bg-white dark:bg-[#1a1a1a] rounded-xl p-2 shadow-xl border border-gray-200 dark:border-white/10 z-50 animate-in fade-in zoom-in-95 duration-200 mt-2"
          sideOffset={5}
          align="end"
        >
          <div className="px-3 py-3 mb-2 border-b border-gray-100 dark:border-white/10">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate mb-1">
              {email || "Usuario"}
            </p>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isSubscriber 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 border border-gray-200 dark:border-white/10'
            }`}>
              {isSubscriber ? <Zap className="w-2.5 h-2.5 fill-current" /> : null}
              {isSubscriber ? 'Plan Premium' : 'Nivel Gratis'}
            </div>
          </div>

          <DropdownMenu.Item asChild>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer outline-none transition-colors"
            >
              <BookOpen className="w-4 h-4 text-gray-400" />
              Mi Biblioteca
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer outline-none transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              Mi Perfil
            </Link>
          </DropdownMenu.Item>

          {!isSubscriber && (
            <DropdownMenu.Item asChild>
              <Link
                href="/subscribe"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer outline-none transition-colors"
              >
                <Zap className="w-4 h-4 fill-current" />
                Mejorar a Premium
              </Link>
            </DropdownMenu.Item>
          )}

          {isSubscriber && (
            <DropdownMenu.Item asChild>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer outline-none transition-colors"
              >
                <CreditCard className="w-4 h-4 text-gray-400" />
                Facturación
              </Link>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-white/10 my-1" />

          <DropdownMenu.Item asChild>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
