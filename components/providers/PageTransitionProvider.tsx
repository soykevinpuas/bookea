"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * PageTransition: Transición sutil entre páginas
 * Solo con CSS, sin overlays visuales
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className={`
        animate-in fade-in duration-200 ease-out
      `}
    >
      {children}
    </div>
  );
}

/**
 * RouteChangeListener: Escucha cambios de ruta para analytics
 */
export function RouteChangeListener({ onRouteChange }: { onRouteChange?: (path: string) => void }) {
  const pathname = usePathname();

  useEffect(() => {
    onRouteChange?.(pathname);
  }, [pathname, onRouteChange]);

  return null;
}
