"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 6.4 - PageTransition: Transición sutil entre páginas
 * Solo con CSS, sin overlays visuales
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayedPath, setDisplayedPath] = useState(pathname);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (pathname !== displayedPath) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayedPath(pathname);
        setIsAnimating(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pathname, displayedPath]);

  return (
    <div 
      className={`
        transition-all duration-200 ease-out
        ${isAnimating ? 'opacity-80' : 'opacity-100'}
      `}
    >
      {children}
    </div>
  );
}

/**
 * 6.4b - RouteChangeListener: Escucha cambios de ruta para analytics
 */
export function RouteChangeListener({ onRouteChange }: { onRouteChange?: (path: string) => void }) {
  const pathname = usePathname();

  useEffect(() => {
    onRouteChange?.(pathname);
  }, [pathname, onRouteChange]);

  return null;
}
