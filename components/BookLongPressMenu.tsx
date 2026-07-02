"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Download, Eye, Trash2, X, Loader2, CheckCircle, MoreVertical, BookmarkPlus } from "lucide-react";
import { isBookDownloaded, downloadBook, removeBookDownload } from "@/lib/downloads";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useUserId } from "@/hooks/useUser";
import { addToLibraryAction, removeFromLibraryAction } from "@/lib/actions/library";
import { useQueryClient } from "@tanstack/react-query";
import { useUserBooks } from "@/hooks/useBooks";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * BookLongPressMenu: Menú contextual que aparece al mantener presionado un libro
 * Opciones: Ver Detalles, Descargar, Eliminar Descarga, Añadir/Quitar de Biblioteca
 */
interface BookLongPressMenuProps {
  book: import("@/types/book").Book;
  children: React.ReactNode;
}

export default function BookLongPressMenu({ book, children }: BookLongPressMenuProps) {
  const { id: bookId, title: bookTitle, epub_url: epubUrl } = book;
  const [showMenu, setShowMenu] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLibraryProcessing, setIsLibraryProcessing] = useState(false);
  const [isDownloadProcessing, setIsDownloadProcessing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { userId } = useUserId();
  const queryClient = useQueryClient();

  // Obtener estado de biblioteca y suscripción
  const { data: userBooks } = useUserBooks(userId || "");
  const { data: subscription } = useSubscription(userId);
  const isInLibrary = userBooks?.some((b: import("@/types/book").Book) => b.id === bookId);

  // Verificar estado de descarga al montar
  useEffect(() => {
    if (epubUrl) {
      isBookDownloaded(epubUrl).then(setIsDownloaded);
    }
  }, [epubUrl]);

  const [menuPosition, setMenuPosition] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement>(null);

  // Calcular posición del menú para evitar recorte
  useEffect(() => {
    if (showMenu && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Si hay menos de 250px abajo (aprox el alto del menú), abrir hacia arriba
      if (spaceBelow < 250) {
        setMenuPosition("top");
      } else {
        setMenuPosition("bottom");
      }
    }
  }, [showMenu]);

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

  const [pressProgress, setPressProgress] = useState(0);
  const pressStartTime = useRef(0);
  const rafRef = useRef<number>(0);
  const touchStartPos = useRef<{x: number; y: number} | null>(null);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressing(false);
    setPressProgress(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    if (!isPressing) return;
    pressStartTime.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - pressStartTime.current;
      setPressProgress(Math.min(elapsed / 700, 1));
      if (elapsed < 700) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPressing]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showMenu) return;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsPressing(true);
    longPressTimer.current = setTimeout(() => {
      setIsPressing(false);
      setShowMenu(true);
    }, 700);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
  };

  const handleDownload = async () => {
    if (!epubUrl) {
      toast.error("Este libro no tiene archivo digital");
      return;
    }
    setIsDownloadProcessing(true);
    const success = await downloadBook(book);
    if (success) {
      setIsDownloaded(true);
      toast.success(`"${bookTitle}" descargado para lectura offline`);
    } else {
      toast.error("Error al descargar el libro");
    }
    setIsDownloadProcessing(false);
    setShowMenu(false);
  };

  const handleRemoveDownload = async () => {
    if (!epubUrl) return;
    setIsDownloadProcessing(true);
    const success = await removeBookDownload(bookId, epubUrl);
    if (success) {
      setIsDownloaded(false);
      toast.info(`"${bookTitle}" eliminado del almacenamiento offline`);
    } else {
      toast.error("Error al eliminar la descarga");
    }
    setIsDownloadProcessing(false);
    setShowMenu(false);
  };

  const handleAddToLibrary = async () => {
    if (!userId) return;
    setIsLibraryProcessing(true);
    queryClient.setQueryData(["userBooks", userId], (old: any) => {
      if (!old) return old;
      return [{ ...book, id: bookId }, ...old];
    });
    try {
      const accessType = subscription?.isActive ? 'subscription' : 'permanent';
      const result = await addToLibraryAction(bookId, accessType as any);
      if (result.success) {
        toast.success(`"${bookTitle}" añadido a tu biblioteca`);
      } else {
        queryClient.setQueryData(["userBooks", userId], (old: any) => {
          if (!old) return old;
          return old.filter((b: any) => b.id !== bookId);
        });
        toast.error(result.error || "No se pudo añadir a la biblioteca");
      }
    } catch {
      queryClient.setQueryData(["userBooks", userId], (old: any) => {
        if (!old) return old;
        return old.filter((b: any) => b.id !== bookId);
      });
      toast.error("Error al conectar con el servidor");
    } finally {
      setIsLibraryProcessing(false);
      setShowMenu(false);
      queryClient.invalidateQueries({ queryKey: ["userBooks", userId] });
    }
  };

  const handleRemoveFromLibrary = async () => {
    if (!userId) return;
    setIsLibraryProcessing(true);
    const oldData = queryClient.getQueryData(["userBooks", userId]);
    queryClient.setQueryData(["userBooks", userId], (old: any) => {
      if (!old) return old;
      return old.filter((b: any) => b.id !== bookId);
    });
    try {
      const result = await removeFromLibraryAction(bookId);
      if (!result.success) {
        queryClient.setQueryData(["userBooks", userId], oldData);
        toast.error(result.error || "Error al quitar de la biblioteca");
      } else {
        toast.info(`"${bookTitle}" quitado de tu biblioteca`);
      }
    } catch {
      queryClient.setQueryData(["userBooks", userId], oldData);
      toast.error("Error del servidor");
    } finally {
      setIsLibraryProcessing(false);
      setShowMenu(false);
      queryClient.invalidateQueries({ queryKey: ["userBooks", userId] });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none transition-transform duration-150 ${isPressing ? 'scale-[0.97]' : ''}`}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } as any}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
      }}
    >
      {/* Indicador de descargado */}
      {isDownloaded && (
        <div className="absolute top-1 right-1 z-20 bg-green-500 rounded-full p-0.5 shadow-lg">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}

      {isPressing && (
        <div
          className="absolute inset-0 z-30 rounded-xl pointer-events-none"
          style={{
            background: pressProgress > 0
              ? `radial-gradient(circle at center, rgba(251,191,36,${pressProgress * 0.15}) 0%, transparent ${Math.max(50, 80 - pressProgress * 60)}%)`
              : 'none',
            boxShadow: `inset 0 0 ${pressProgress * 14}px rgba(251,191,36,${pressProgress * 0.3})`,
            border: `1.5px solid rgba(251,191,36,${pressProgress * 0.5})`,
            transition: 'background 0.05s linear, box-shadow 0.05s linear, border-color 0.05s linear',
          }}
        />
      )}

      {children}

      {/* Botón de activación para Mouse/Trackpad (Tres puntos) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-1 left-1 z-30 p-1 bg-black/60 hover:bg-black/80 text-white/50 hover:text-white rounded-full opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.85, y: menuPosition === "bottom" ? -20 : 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: menuPosition === "bottom" ? -20 : 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={`absolute left-1/2 -translate-x-1/2 z-[100] w-56 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl ${
              menuPosition === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
            }`}
          >
            {/* Header del menú */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-xs font-bold text-white/60 truncate max-w-[160px]">{bookTitle}</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="p-1 hover:bg-white/10 rounded-full"
              >
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
                  disabled={isDownloadProcessing || !epubUrl}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-white/80 disabled:opacity-40"
                >
                  {isDownloadProcessing ? (
                    <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-green-400" />
                  )}
                  <span className="text-sm font-medium">
                    {isDownloadProcessing ? "Descargando..." : "Descargar Offline"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleRemoveDownload}
                  disabled={isDownloadProcessing}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-red-400"
                >
                  {isDownloadProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {isDownloadProcessing ? "Eliminando..." : "Eliminar Descarga"}
                  </span>
                </button>
              )}

              <div className="border-t border-white/5 my-1" />

              {( isInLibrary || !book.is_premium || subscription?.isActive ) && (
                !isInLibrary ? (
                  <button
                    onClick={handleAddToLibrary}
                    disabled={isLibraryProcessing}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 transition-colors text-amber-500/80"
                  >
                    {isLibraryProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    ) : (
                      <BookmarkPlus className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="text-sm font-bold">Añadir a Biblioteca</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRemoveFromLibrary}
                    disabled={isLibraryProcessing}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-red-500/80"
                  >
                    {isLibraryProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-bold">Quitar de Biblioteca</span>
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
