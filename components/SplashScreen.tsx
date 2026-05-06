"use client";

import { useEffect } from "react";

/**
 * 1.7 - SplashScreen: Controlador del splash screen HTML puro.
 * El splash se renderiza directamente en el layout como HTML/CSS.
 * Este componente solo se encarga de OCULTARLO cuando React está listo.
 * Se muestra solo una vez por sesión (usando sessionStorage).
 */
export function SplashScreen() {
  useEffect(() => {
    const splash = document.getElementById("bookea-splash");
    if (!splash) return;

    const hasShown = sessionStorage.getItem("bookea-splash-shown");

    if (hasShown) {
      // Ya se mostró en esta sesión: ocultar inmediatamente
      splash.classList.add("splash-hide");
      setTimeout(() => { splash.style.display = "none"; }, 600);
    } else {
      // Primera vez: dejar que la animación termine (2s) y luego ocultar
      sessionStorage.setItem("bookea-splash-shown", "true");
      setTimeout(() => {
        splash.classList.add("splash-hide");
        setTimeout(() => { splash.style.display = "none"; }, 600);
      }, 2200);
    }
  }, []);

  return null;
}
