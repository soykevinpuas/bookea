"use client";

import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";

/**
 * PageTransitionWrapper: Client Component que maneja la transición de páginas
 * Usa usePathname para detectar cambios de ruta y animar la transición
 */
export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    /* key por ruta fuerza remount controlado para reiniciar la animacion. */
    <PageTransition key={pathname}>
      {children}
    </PageTransition>
  );
}
