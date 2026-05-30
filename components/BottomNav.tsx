"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Compass, User, Library, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { PrefetchLink } from "@/components/ui/LoadingStates";

export function BottomNav() {
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const isLanding = pathname === "/";
  if (isLanding) return null;

  const navItems = [
    {
      label: "Catálogo",
      icon: <Compass className="w-6 h-6" />,
      href: "/catalog",
      active: pathname === "/catalog"
    },
    {
      label: "Biblioteca",
      icon: <Library className="w-6 h-6" />,
      href: "/dashboard",
      active: pathname === "/dashboard"
    },
    {
      label: "Perfil",
      icon: <User className="w-6 h-6" />,
      href: "/profile",
      active: pathname === "/profile"
    }
  ];

  const handleNavClick = (href: string) => {
    if (href === pathname) return;
    setNavigatingTo(href);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center pb-safe px-4 md:hidden">
      <div className="mb-4 mx-auto max-w-sm bg-white/70 dark:bg-black/80 retro:bg-[#0d1117]/90 navy:bg-[#0a0f1e]/90 backdrop-blur-xl border border-black/5 dark:border-white/10 retro:border-[#3fb950]/30 navy:border-[#7986cb]/30 rounded-2xl shadow-2xl flex items-center justify-around py-3 px-2">
        {navItems.map((item) => {
          const loading = navigatingTo === item.href;
          return (
            <PrefetchLink
              key={item.href}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 relative group px-4 py-1 rounded-xl ${
                loading
                  ? "opacity-50 pointer-events-none text-gray-400 dark:text-gray-500"
                  : item.active
                    ? "text-blue-600 dark:text-blue-400 retro:text-[#3fb950] navy:text-[#7986cb]"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {item.active && !loading && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 retro:bg-[#3fb950]/10 navy:bg-[#7986cb]/10 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              <div className={`relative ${item.active ? 'drop-shadow-[0_0_6px_currentColor]' : ''}`}>
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : item.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {item.label}
              </span>
            </PrefetchLink>
          );
        })}
      </div>
    </div>
  );
}
