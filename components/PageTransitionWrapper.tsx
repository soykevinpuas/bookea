"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";

/**
 * 6.7.1 - PageTransitionWrapper: Client Component que maneja la transición de páginas
 * Usa usePathname para detectar cambios de ruta y animar la transición
 */
export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={pathname}>
        {children}
      </PageTransition>
    </AnimatePresence>
  );
}
