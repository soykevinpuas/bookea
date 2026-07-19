"use client";

import { useEffect } from "react";
import { syncOfflineProgress } from "@/lib/sync";

// PwaListener: Registra el Service Worker en el navegador silenciosamente para habilitar persistencia nativa
export function PwaListener() {
  useEffect(() => {
    // Disparar sincronización al inicio y cuando vuelve la red
    syncOfflineProgress();
    window.addEventListener('online', syncOfflineProgress);

    let cleanupServiceWorker = () => {};

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const hadController = !!navigator.serviceWorker.controller;
      let reloadingForUpdate = false;
      const handleControllerChange = () => {
        if (!hadController) return;
        if (reloadingForUpdate) return;
        reloadingForUpdate = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

      // Registra sin cachear sw.js para que los deploys nuevos tomen control en PWA instalada.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          const activateWaitingWorker = () => {
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          };

          if (registration.waiting) activateWaitingWorker();

          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;

            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                activateWaitingWorker();
              }
            });
          });

          return registration.update();
        })
        .catch((err) => console.error("SW Fallo:", err));

      cleanupServiceWorker = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      };
    }

    return () => {
      cleanupServiceWorker();
      window.removeEventListener('online', syncOfflineProgress);
    };
  }, []);

  return null;
}
