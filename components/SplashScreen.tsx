"use client";

import { useEffect } from "react";

/**
 * SplashScreen: Controlador del splash screen HTML puro.
 * El splash se renderiza directamente en el layout como HTML/CSS.
 * Este componente solo se encarga de OCULTARLO cuando React está listo.
 * Se muestra en cada arranque completo de la app, no en navegación interna.
 */
export function SplashScreen() {
  useEffect(() => {
    const splash = document.getElementById("bookea-splash");
    if (!splash) return;

    const hideTimer = setTimeout(() => {
      splash.classList.add("splash-hide");
      setTimeout(() => { splash.style.display = "none"; }, 600);
    }, 700);

    return () => {
      clearTimeout(hideTimer);
    };
  }, []);

  return null;
}
