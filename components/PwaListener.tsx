"use client";

import { useEffect } from "react";
import { syncOfflineProgress } from "@/lib/sync";

// 1.8 - PwaListener: Registra el Service Worker en el navegador silenciosamente para habilitar persistencia nativa
export function PwaListener() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register the service worker after hydration
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW Registrado:", reg.scope))
        .catch((err) => console.error("SW Fallo:", err));
    }

    // 8.6.1 - Disparar sincronización al inicio y cuando vuelve la red
    syncOfflineProgress();
    
    window.addEventListener('online', syncOfflineProgress);
    return () => window.removeEventListener('online', syncOfflineProgress);
  }, []);

  return null;
}
