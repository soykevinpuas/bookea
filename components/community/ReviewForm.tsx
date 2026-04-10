"use client";

import { useState, useEffect } from "react";
import { useUserId } from "@/hooks/useUser";
import { useProfile } from "@/hooks/useAvatars";
import { useReviews } from "@/hooks/useReviews";
import StarRating from "./StarRating";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageSquarePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ANIMAL_AVATARS, getAvatarStyle } from "@/lib/avatars";

/**
 * 6.8 - ReviewForm: Formulario dinámico para la participación ciudadana en Bookea
 */

interface ReviewFormProps {
  bookId: string;
}

export default function ReviewForm({ bookId }: ReviewFormProps) {
  const { userId, isLoading: authLoading } = useUserId();
  const { profile } = useProfile(userId);
  const { reviews, saveReview, isSaving } = useReviews(bookId);

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // 6.8.1 - Buscar si el usuario ya tiene una reseña para precargar
  useEffect(() => {
    const existing = reviews.find(r => r.user_id === userId);
    if (existing) {
      setRating(existing.rating);
      setContent(existing.content);
    }
  }, [reviews, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Debes iniciar sesión para comentar");
      return;
    }
    if (rating === 0) {
      toast.error("Por favor selecciona una calificación");
      return;
    }
    if (!content.trim()) {
      toast.error("Escribe un comentario");
      return;
    }

    try {
      await saveReview({ userId, rating, content });
      toast.success("¡Reseña guardada con éxito!");
      setIsExpanded(false);
    } catch {
      toast.error("Error al guardar la reseña");
    }
  };

  if (authLoading) return null;

  if (!userId) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-3xl text-center bg-gray-50/50 dark:bg-white/5 backdrop-blur-sm">
        <MessageSquarePlus className="w-10 h-10 mx-auto text-gray-300 dark:text-white/20 mb-4" />
        <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Únete a la conversación</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
          Inicia sesión para compartir tu opinión con la comunidad Bookea.
        </p>
        <a 
          href="/login" 
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all"
        >
          Iniciar Sesión
        </a>
      </div>
    );
  }

  // 6.8.2 - UI del Formulario para usuario autenticado
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl p-6 shadow-sm overflow-hidden relative group">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-10 group-hover:bg-blue-500/10 transition-colors" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-white/5 overflow-hidden flex-shrink-0 bg-white/5">
             {profile?.avatar_url?.startsWith("avatar:") ? (
                <div 
                  className="w-full h-full"
                  style={getAvatarStyle(profile.avatar_url)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-600 font-bold text-white">
                   {profile?.name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
          </div>
          
          <div className="flex-1 space-y-1">
             <p className="text-sm font-bold text-gray-900 dark:text-white">
                {profile?.name || "Lector Bookea"}
             </p>
             <div className="flex items-center gap-2 pt-1">
                <StarRating rating={rating} onRatingChange={setRating} />
             </div>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="¿Qué te pareció este libro?"
            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500/50 transition-all resize-none min-h-[100px]"
          />
          
          <AnimatePresence>
            {(isExpanded || content.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex justify-end pt-2"
              >
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {reviews.some(r => r.user_id === userId) ? "Actualizar Reseña" : "Publicar Reseña"}
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}
