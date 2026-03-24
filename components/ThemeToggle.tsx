"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Terminal } from "lucide-react";

// ============================================
// 6.2 - ThemeToggle: Botón para alternar entre tema claro, oscuro y retro
// Utiliza el sistema de temas de next-themes para persistencia
// ============================================

export function ThemeToggle() {
  // Estado para evitar hidratación incorrecta (SSR vs Client)
  const [mounted, setMounted] = useState(false);
  
  // Hook de next-themes para gestionar el tema actual
  const { theme, setTheme } = useTheme();

  // Efecto para marcar que el componente se ha montado en el cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Placeholder durante SSR para evitar cumulative layout shift
  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  // 6.2.1 - Lógica de ciclo de temas: light -> dark -> retro
  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("retro");
    else setTheme("light");
  };

  // 6.2.2 - Renderizado del botón de toggle con icono dinámico
  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors shadow-sm cursor-pointer flex items-center justify-center ${
        theme === "retro" 
          ? "bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20 hover:bg-[#3fb950]/20" 
          : "bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700"
      }`}
      aria-label="Alternar modo de color"
    >
      {/* Icono dinámico según el tema actual */}
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : theme === "retro" ? (
        <Terminal className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
