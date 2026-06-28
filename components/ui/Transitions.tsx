"use client";

import { usePathname } from "next/navigation";
import { useIsClient } from "@/hooks/useIsClient";

/**
 * 6.4 - PageSmoother: Transición sutil entre páginas
 * Crea un overlay que se desvanece suavemente al navegar
 */
export function PageSmoother({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="relative animate-in fade-in duration-200 ease-out">
      {children}
    </div>
  );
}

/**
 * 6.4b - FadeTransition: Alternativa más sutil solo con CSS
 * Agrega este componente al layout raíz
 */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const mounted = useIsClient();

  return (
    <div
      className={`
        transition-all duration-300 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
      `}
    >
      {children}
    </div>
  );
}
