"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Download, Eye, Trash2, X, Loader2, CheckCircle } from "lucide-react";
import { isBookDownloaded, downloadBook, removeBookDownload } from "@/lib/downloads";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 8.5 - BookLongPressMenu: Menú contextual que aparece al mantener presionado un libro
 * Opciones: Ver Detalles, Descargar, Eliminar Descarga
 */
interface BookLongPressMenuProps {
  book: import("@/types/book").Book;
  children: React.ReactNode;
}

export default function BookLongPressMenu({ book, children }: BookLongPressMenuProps) {
  const { id: bookId, title: bookTitle, epub_url: epubUrl } = book;
  const [showMenu, setShowMenu] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Verificar estado de descarga al montar
  useEffect(() => {
    if (epubUrl) {
      isBookDownloaded(epubUrl).then(setIsDownloaded);
    }
  }, [epubUrl]);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside as any);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as any);
    };
  }, [showMenu]);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDownload = async () => {
    if (!epubUrl) {
      toast.error("Este libro no tiene archivo digital");
      return;
    }
    setIsProcessing(true);
    const success = await downloadBook(book);
    if (success) {
      setIsDownloaded(true);
      toast.success(`"${bookTitle}" descargado para lectura offline`);
    } else {
      toast.error("Error al descargar el libro");
    }
    setIsProcessing(false);
    setShowMenu(false);
  };

  const handleRemoveDownload = async () => {
    if (!epubUrl) return;
    setIsProcessing(true);
    const success = await removeBookDownload(bookId, epubUrl);
    if (success) {
      setIsDownloaded(false);
      toast.info(`"${bookTitle}" eliminado del almacenamiento offline`);
    } else {
      toast.error("Error al eliminar la descarga");
    }
    setIsProcessing(false);
    setShowMenu(false);
  };

  return (
    <div
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
    >
      {/* Indicador de descargado */}
      {isDownloaded && (
        <div className="absolute top-1 right-1 z-20 bg-green-500 rounded-full p-0.5 shadow-lg">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}

      {children}

      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[100] w-56 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            {/* Header del menú */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-bold text-white/60 truncate max-w-[160px]">{bookTitle}</p>
              <button onClick={() => setShowMenu(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-3 h-3 text-white/40" />
              </button>
            </div>

            {/* Opciones */}
            <div className="py-1">
              <Link
                href={`/book/${bookId}`}
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-white/80"
              >
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">Ver Detalles</span>
              </Link>

              {!isDownloaded ? (
                <button
                  onClick={handleDownload}
                  disabled={isProcessing || !epubUrl}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-white/80 disabled:opacity-40"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-green-400" />
                  )}
                  <span className="text-sm font-medium">
                    {isProcessing ? "Descargando..." : "Descargar Offline"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleRemoveDownload}
                  disabled={isProcessing}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-red-400"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {isProcessing ? "Eliminando..." : "Eliminar Descarga"}
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
