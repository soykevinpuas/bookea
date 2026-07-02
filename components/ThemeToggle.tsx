"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Terminal, Anchor } from "lucide-react";
import { useIsClient } from "@/hooks/useIsClient";

// ============================================
// ThemeToggle: Botón para alternar entre todos los temas disponibles
// Ciclo: Light -> Dark -> Retro -> Navy
// ============================================

export function ThemeToggle() {
  const mounted = useIsClient();
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  // Ciclo completo: Light -> Dark -> Retro -> Navy
  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("retro");
    else if (theme === "retro") setTheme("navy");
    else setTheme("light");
  };

  // Renderizado dinámico de icono y colores según el tema activo
  const renderIcon = () => {
    switch (theme) {
      case "dark":
        return <Moon className="w-5 h-5 text-blue-400" />;
      case "retro":
        return <Terminal className="w-5 h-5 text-[#3fb950]" />;
      case "navy":
        return <Anchor className="w-5 h-5 text-[#7986cb]" />;
      default:
        return <Sun className="w-5 h-5 text-amber-500" />;
    }
  };

  const btnClasses = {
    light: "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200",
    dark: "bg-gray-800 text-gray-100 hover:bg-gray-700 border-white/10",
    retro: "bg-[#0d1117] text-[#3fb950] hover:bg-black border-[#3fb950]/30",
    navy: "bg-[#0d1422] text-[#c5cae9] hover:bg-[#0a0f1e] border-[#7986cb]/30",
  };

  return (
    <button
      onClick={cycleTheme}
      className={`p-2 rounded-lg transition-all shadow-sm cursor-pointer flex items-center justify-center border ${
        btnClasses[theme as keyof typeof btnClasses] || btnClasses.light
      }`}
      aria-label="Alternar modo de color"
    >
      {renderIcon()}
    </button>
  );
}
