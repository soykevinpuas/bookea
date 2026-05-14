"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, BookOpen, ShoppingCart } from "lucide-react";

const STORAGE_KEY = "bookea-panel-onboarding-seen";

export default function PanelOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={dismiss} />
      <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl max-w-sm w-full p-5 pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
        <button onClick={dismiss} className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold mb-4 mt-1">Navegación rápida</h3>

        {isDesktop ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Carrito</p>
                <p className="text-xs text-gray-500">Haz clic en el icono del carrito en la parte superior</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Biblioteca rápida</p>
                <p className="text-xs text-gray-500">Haz clic en el icono del libro junto al carrito</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Carrito</p>
                <p className="text-xs text-gray-500">Desliza desde el <strong>borde izquierdo</strong> hacia la derecha</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Biblioteca rápida</p>
                <p className="text-xs text-gray-500">Desliza desde el <strong>borde derecho</strong> hacia la izquierda</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
          <p className="text-[10px] text-gray-400 flex-1">Puedes volver a ver esto desde Ajustes</p>
          <button
            onClick={dismiss}
            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl hover:opacity-90 transition-all"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}
