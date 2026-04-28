"use client";

import { motion } from "framer-motion";

/**
 * 6.7 - PageTransition: Transiciones suaves entre páginas
 * Uso: Envuelve {children} en layout.tsx para animar cambios de ruta
 */
export function PageTransition({ children, key }: { children: React.ReactNode; key?: string }) {
  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.3, 
        ease: [0.4, 0, 0.2, 1] // Cubic-bezier para sensación nativa
      }}
      className="flex-1"
    >
      {children}
    </motion.div>
  );
}
