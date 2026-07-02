"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBookReviews, saveReview, deleteReview } from "@/lib/reviews";
import { useEffect } from "react";
import { createClientClient } from "@/lib/supabase";

/**
 * useReviews: Hook de gestión de la comunidad con soporte Realtime nativo
 */

export function useReviews(bookId: string) {
  const queryClient = useQueryClient();
  const supabase = createClientClient();

  // Consulta de todas las reseñas del libro
  const reviewsQuery = useQuery({
    queryKey: ["reviews", bookId],
    queryFn: () => getBookReviews(bookId),
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Promedio de calificación computado
  const averageRating = reviewsQuery.data?.length
    ? (reviewsQuery.data.reduce((acc, curr) => acc + curr.rating, 0) / reviewsQuery.data.length).toFixed(1)
    : "0";

  // Mutación para guardar/actualizar reseña
  const saveMutation = useMutation({
    mutationFn: ({ userId, rating, content }: { userId: string; rating: number; content: string }) =>
      saveReview(bookId, userId, rating, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
    },
  });

  // Mutación para eliminar reseña
  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
    },
  });

  // Suscripción Realtime para actualizaciones automáticas
  useEffect(() => {
    if (!bookId) return;

    // Suscribirse a cambios en la tabla 'reviews' solo para este libro
    const channel = supabase
      .channel(`realtime-reviews-${bookId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `book_id=eq.${bookId}`
        },
        () => {
          // React Query invalidará y refrescará los datos automáticamente
          queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId, queryClient, supabase]);

  return {
    reviews: reviewsQuery.data || [],
    isLoading: reviewsQuery.isLoading,
    saveReview: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    deleteReview: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    averageRating,
  };
}
