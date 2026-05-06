"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Bookmark, User, Library } from "lucide-react";
import { motion } from "framer-motion";
import { useTransition } from "react";
import { PrefetchLink } from "@/components/ui/LoadingStates";

// ============================================
// 6.6 - BottomNav: Barra de navegación inferior móvil
// Diseñada para acceso rápido a secciones principales con lógica de scroll
// ============================================

export function BottomNav() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // 6.6.1 - Lógica de detección de scroll para mostrar/ocultar
  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== "undefined") {
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
          // Bajando: ocultar
          setIsVisible(false);
        } else {
          // Subiendo o cerca del inicio: mostrar
          setIsVisible(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    window.addEventListener("scroll", controlNavbar);
    return () => {
      window.removeEventListener("scroll", controlNavbar);
    };
  }, [lastScrollY]);

  // Si estamos en el lector o en páginas de auth, no mostramos el nav
  const isReader = pathname?.includes("/reader/");
  const isAuth = pathname?.includes("/login") || pathname?.includes("/register");
  
  if (isReader || isAuth) return null;

  const navItems = [
    {
      label: "Catálogo",
      icon: <Compass className="w-5 h-5" />,
      href: "/catalog",
      active: pathname === "/catalog"
    },
    {
      label: "Biblioteca",
      icon: <Library className="w-5 h-5" />,
      href: "/dashboard",
      active: pathname === "/dashboard"
    },
    {
      label: "Perfil",
      icon: <User className="w-5 h-5" />,
      href: "/profile",
      active: pathname === "/profile"
    }
  ];

  return (
    <>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center pb-safe px-4"
        >
          <div className="mb-4 mx-auto max-w-sm bg-white/70 dark:bg-black/80 retro:bg-[#0d1117]/90 navy:bg-[#0a0f1e]/90 backdrop-blur-xl border border-black/5 dark:border-white/10 retro:border-[#3fb950]/30 navy:border-[#7986cb]/30 rounded-2xl shadow-2xl flex items-center justify-around py-3 px-2">
            {navItems.map((item) => {
              return (
                <PrefetchLink
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 transition-all duration-300 relative group px-4 py-1 rounded-xl ${
                    item.active 
                      ? "text-blue-600 dark:text-blue-400 retro:text-[#3fb950] navy:text-[#7986cb]" 
                      : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}
                >
                  {/* Indicador de activo (pestaña) */}
                  {item.active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 retro:bg-[#3fb950]/10 navy:bg-[#7986cb]/10 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <div className="relative">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter">
                    {item.label}
                  </span>
                </PrefetchLink>
              );
            })}
          </div>
        </motion.div>
      )}
    </>
  );
}
