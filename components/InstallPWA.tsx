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
      className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all backdrop-blur-sm shadow-sm flex items-center justify-center gap-2"
    >
      <Smartphone className="w-5 h-5" />
      Descargar App
    </button>
  );
}

// Tipo para el evento beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
