"use client";

import { useReviews } from "@/hooks/useReviews";
import StarRating from "./StarRating";
import { ANIMAL_AVATARS, getAvatarStyle } from "@/lib/avatars";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Calendar, Trash2, Loader2, Sparkles } from "lucide-react";
import { useUserId } from "@/hooks/useUser";
import { toast } from "sonner";

/**
 * 6.9 - ReviewList: Visualización premium de la comunidad y sus opiniones
 */

interface ReviewListProps {
  bookId: string;
}

export default function ReviewList({ bookId }: ReviewListProps) {
  const { reviews, isLoading, deleteReview, isDeleting, averageRating } = useReviews(bookId);
  const { userId } = useUserId();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Cargando comunidad...</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="py-12 text-center bg-gray-50/30 dark:bg-white/5 rounded-3xl border border-dashed border-gray-100 dark:border-white/5">
        <MessageSquare className="w-12 h-12 mx-auto text-gray-200 dark:text-white/10 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Sé el primero en comentar</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          Comparte tu opinión con otros lectores y ayuda a construir la comunidad Bookea.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 6.9.1 - Resumen de Calificaciones */}
      <div className="flex items-center justify-between p-6 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-black text-gray-900 dark:text-white flex items-center gap-2">
             <StarRating rating={Math.round(Number(averageRating))} readOnly size="sm" />
             {averageRating}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Reputación del libro</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Promedio basado en {reviews.length} reseñas</p>
          </div>
        </div>
        <div className="hidden sm:block">
           <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
        </div>
      </div>

      {/* 6.9.2 - Lista Staggered de Reseñas */}
      <div className="space-y-4">
        <AnimatePresence>
          {reviews.map((review, index) => {
            const isOwner = review.user_id === userId;
            const avatar = ANIMAL_AVATARS.find(a => `avatar:${a.id}` === review.profiles?.avatar_url);
            
            return (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative bg-white dark:bg-white/2 bg-opacity-50 dark:bg-opacity-20 border border-gray-100 dark:border-white/5 rounded-2xl p-6 transition-all hover:bg-white dark:hover:bg-white/5 hover:border-gray-200 dark:hover:border-white/10"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar con sprite clipping */}
                  <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden flex-shrink-0 bg-white/10 shadow-sm relative">
                    {review.profiles?.avatar_url?.startsWith("avatar:") ? (
                        <div 
                          className="w-full h-full"
                          style={getAvatarStyle(review.profiles.avatar_url)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-600 font-bold text-white text-xs">
                           {review.profiles?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">
                        {review.profiles?.name || "Lector Bookea"}
                      </h4>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-white/20 uppercase font-black tracking-widest whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                        
                        {isOwner && (
                          <button
                            onClick={() => deleteReview(review.id)}
                            disabled={isDeleting}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-1 rounded-md transition-colors disabled:opacity-50"
                          >
                             {isDeleting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <StarRating rating={review.rating} readOnly size="sm" />
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed break-words">
                      {review.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
