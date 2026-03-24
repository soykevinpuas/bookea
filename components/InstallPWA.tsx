"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";

// ============================================
// 6.6 - InstallPWA: Componente para instalar la aplicación web progresiva (PWA)
// Maneja el flujo de instalación nativo del navegador
// ============================================

interface InstallPWAProps {
  variant?: "button" | "menuitem";
}

// 6.6.1 - Componente principal de instalación PWA
export function InstallPWA({ variant = "button" }: InstallPWAProps) {
  // Evento diferido de instalación (API beforeinstallprompt)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // 6.6.1.1 - Efecto para detectar capacidades de instalación PWA
  useEffect(() => {
    // Paso 1: Detectar si la app ya está instalada (modo standalone)
    if (typeof window !== "undefined" && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Paso 2: Escuchar el evento beforeinstallprompt (disponible antes de instalación)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Paso 3: Escuchar evento de instalación exitosa
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      toast.success("¡Bookea instalado con éxito!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // 6.6.1.2 - Handler para mostrar el prompt de instalación nativo
  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!deferredPrompt) return;

    // Mostrar prompt de instalación nativo del navegador
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // No renderizar si ya está instalada o no es instalable
  if (isInstalled || !isInstallable) return null;

  // 6.6.2 - Renderizado según variante (botón standalone o item de menú)
  if (variant === "menuitem") {
    return (
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer outline-none transition-colors"
      >
        <Smartphone className="w-4 h-4" />
        Instalar App móvil
      </button>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-100 dark:hover:bg-blue-600/20 rounded-xl transition-all border border-blue-100 dark:border-blue-500/20"
    >
      <Smartphone className="w-4 h-4" />
      <span>Descargar App móvil</span>
    </button>
  );
}

// Tipo para el evento beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
