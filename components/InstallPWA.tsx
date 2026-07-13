"use client";

import { useEffect, useState } from "react";
import { Smartphone, SquareArrowOutUpRight, SquarePlus } from "lucide-react";
import { toast } from "sonner";

interface InstallPWAProps {
  variant?: "button" | "menuitem";
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA({ variant = "button" }: InstallPWAProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(() => (
    typeof window === "undefined" || typeof navigator === "undefined"
      ? false
      : /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
  ));
  const [isInstalled, setIsInstalled] = useState(() => (
    typeof window !== "undefined" && window.matchMedia('(display-mode: standalone)').matches
  ));
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      toast.success("Bookea instalado con éxito");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isIOS) {
      setShowIOSHint(true);
      return;
    }

    if (!deferredPrompt) {
      toast.info("Abre Bookea desde el menú de tu navegador: Compartir > Agregar a Inicio");
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  const sharedStyles = variant === "menuitem"
    ? "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
    : "w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all backdrop-blur-sm shadow-sm flex items-center justify-center gap-2";

  return (
    <>
      <button onClick={handleInstallClick} className={sharedStyles}>
        {isIOS ? <SquareArrowOutUpRight className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        {variant === "menuitem" ? "Instalar App" : "Descargar App"}
      </button>

      {showIOSHint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowIOSHint(false)} />
          <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-sm shadow-2xl border border-white/10">
            <h3 className="text-lg font-bold mb-3">Instalar en iOS</h3>
            <ol className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
              <li>1. Toca el botón <strong>Compartir</strong> <SquareArrowOutUpRight className="w-4 h-4 inline" /> en Safari</li>
              <li>2. Desliza hacia abajo</li>
              <li>3. Toca <strong>Agregar a Inicio</strong> <SquarePlus className="w-4 h-4 inline" /></li>
              <li>4. Toca <strong>Agregar</strong> en la esquina</li>
            </ol>
            <button onClick={() => setShowIOSHint(false)} className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
