"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 6.4 - PageSmoother: Transición sutil entre páginas
 * Crea un overlay que se desvanece suavemente al navegar
 */
export function PageSmoother({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);

  useEffect(() => {
    // Iniciar transición de salida
    setIsTransitioning(true);
    
    // Después de la animación, actualizar contenido
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setIsTransitioning(false);
    }, 150);
    
    return () => clearTimeout(timer);
  }, [pathname, children]);

  return (
    <div className="relative">
      {displayChildren}
      
      {/* Overlay de transición super sutil */}
      <div 
        className={`
          fixed inset-0 z-[100] pointer-events-none bg-[#0a0a0a]
          transition-opacity duration-200 ease-out
          ${isTransitioning ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  );
}

/**
 * 6.4b - FadeTransition: Alternativa más sutil solo con CSS
 * Agrega este componente al layout raíz
 */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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