"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { User, LogOut, BookOpen, ChevronDown, Zap, CreditCard } from "lucide-react";
import Link from "next/link";
import { createClientClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InstallPWA } from "./InstallPWA";

// ============================================
// 6.5 - UserMenu: Menú desplegable de usuario autenticado
// Muestra información del usuario, rol, navegación y opciones de cuenta
// ============================================

interface UserMenuProps {
  email: string | undefined;
}

// 6.5.1 - Componente principal del menú de usuario
export function UserMenu({ email }: UserMenuProps) {
  const router = useRouter();
  const supabase = createClientClient();
  
  // Estado para almacenar el rol del usuario (free/subscriber)
  const [role, setRole] = useState<string>("free");

  // 6.5.1.1 - Efecto para obtener el rol del usuario desde la base de datos
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

  // 6.5.1.2 - Handler para cerrar sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Determinación de si el usuario tiene suscripción activa
  const isSubscriber = role === 'subscriber';

  // ============================================
  // 6.5.2 - Renderizado del menú de usuario
  // ============================================
  return (
    <DropdownMenu.Root>
      {/* 6.5.2.1 - Botón trigger del menú (avatar de usuario) */}
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Menú de usuario"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shadow-sm">
            {/* Inicial del email o icono genérico */}
            {email ? email.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-1" />
        </button>
      </DropdownMenu.Trigger>

      {/* 6.5.2.2 - Contenido del menú desplegable */}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[240px] bg-white dark:bg-[#1a1a1a] retro:bg-[#0d1117] rounded-xl p-2 shadow-xl border border-gray-200 dark:border-white/10 retro:border-[#3fb950]/20 z-50 animate-in fade-in zoom-in-95 duration-200 mt-2"
          sideOffset={5}
          align="end"
        >
          {/* 6.5.2.2.1 - Encabezado con email y badge de suscripción */}
          <div className="px-3 py-3 mb-2 border-b border-gray-100 dark:border-white/10 retro:border-[#3fb950]/20">
            <p className="text-sm font-bold text-gray-900 dark:text-white retro:text-[#3fb950] truncate mb-1">
              {email || "Usuario"}
            </p>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isSubscriber 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 border border-gray-200 dark:border-white/10 retro:border-[#3fb950]/20 retro:text-[#3fb950]'
            }`}>
              {isSubscriber ? <Zap className="w-2.5 h-2.5 fill-current" /> : null}
              {isSubscriber ? 'Plan Premium' : 'Nivel Gratis'}
            </div>
          </div>

          {/* 6.5.2.2.2 - Navegación a Biblioteca */}
          <DropdownMenu.Item asChild>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 retro:text-[#3fb950] rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 retro:hover:bg-[#3fb950]/10 cursor-pointer outline-none transition-colors"
            >
              <BookOpen className="w-4 h-4 text-gray-400 dark:text-white/40 retro:text-[#3fb950]" />
              Mi Biblioteca
            </Link>
          </DropdownMenu.Item>

          {/* 6.5.2.2.3 - Navegación a Perfil */}
          <DropdownMenu.Item asChild>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 retro:text-[#3fb950] rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 retro:hover:bg-[#3fb950]/10 cursor-pointer outline-none transition-colors"
            >
              <User className="w-4 h-4 text-gray-400 dark:text-white/40 retro:text-[#3fb950]" />
              Mi Perfil
            </Link>
          </DropdownMenu.Item>

          {/* 6.5.2.2.4 - Opción de upgrade para usuarios free */}
          {!isSubscriber && (
            <DropdownMenu.Item asChild>
              <Link
                href="/subscribe"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-blue-600 dark:text-blue-400 retro:text-[#3fb950] rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 retro:hover:bg-[#3fb950]/10 cursor-pointer outline-none transition-colors"
              >
                <Zap className="w-4 h-4 fill-current" />
                Mejorar a Premium
              </Link>
            </DropdownMenu.Item>
          )}

          {/* 6.5.2.2.5 - Opción de facturación para suscriptores */}
          {isSubscriber && (
            <DropdownMenu.Item asChild>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 retro:text-[#3fb950] rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 retro:hover:bg-[#3fb950]/10 cursor-pointer outline-none transition-colors"
              >
                <CreditCard className="w-4 h-4 text-gray-400 dark:text-white/40 retro:text-[#3fb950]" />
                Facturación
              </Link>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-white/10 my-1 retro:bg-[#3fb950]/20" />

          {/* 6.5.2.2.6 - Opción de instalación PWA */}
          <DropdownMenu.Item asChild>
            <InstallPWA variant="menuitem" />
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-white/10 my-1 retro:bg-[#3fb950]/20" />

          {/* 6.5.2.2.7 - Botón de cerrar sesión */}
          <DropdownMenu.Item asChild>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 retro:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 retro:hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
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
