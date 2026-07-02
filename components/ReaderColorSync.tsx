"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useIsClient } from "@/hooks/useIsClient";

// ReaderColorSync: Sincroniza el color de texto seleccionado en el lector con el tema global de la app
export function ReaderColorSync() {
  const { theme } = useTheme();
  const mounted = useIsClient();

  // Solo escribe variables CSS en cliente; evita hydration mismatch con next-themes.
  useEffect(() => {
    if (!mounted) return;

    // El color personalizado del lector solo aplica en fondos oscuros compatibles.
    const savedColor = localStorage.getItem("bookea-reader-color");
    if (savedColor && (theme === "dark" || theme === "retro")) {
      document.documentElement.style.setProperty("--bookea-reader-color", savedColor);
      document.documentElement.setAttribute("data-reader-color", "true");
    }
  }, [theme, mounted]);

  return null;
}
