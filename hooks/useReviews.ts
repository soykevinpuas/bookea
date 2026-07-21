"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBookReviews, saveReview, deleteReview, type Review } from "@/lib/reviews";
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
    onMutate: async ({ userId, rating, content }) => {
      await queryClient.cancelQueries({ queryKey: ["reviews", bookId] });
      const previous = queryClient.getQueryData<Review[]>(["reviews", bookId]);
      queryClient.setQueryData<Review[]>(["reviews", bookId], (old = []) => {
        const existing = old.find((review) => review.user_id === userId);
        if (existing) {
          return old.map((review) => review.user_id === userId ? { ...review, rating, content } : review);
        }
        return [{
          id: `optimistic-${userId}-${bookId}`,
          book_id: bookId,
          user_id: userId,
          rating,
          content,
          created_at: new Date().toISOString(),
        }, ...old];
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["reviews", bookId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
    },
  });

  // Mutación para eliminar reseña
  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId),
    onMutate: async (reviewId) => {
      await queryClient.cancelQueries({ queryKey: ["reviews", bookId] });
      const previous = queryClient.getQueryData<Review[]>(["reviews", bookId]);
      queryClient.setQueryData<Review[]>(["reviews", bookId], (old) => old?.filter((review) => review.id !== reviewId));
      return { previous };
    },
    onError: (_error, _reviewId, context) => {
      if (context?.previous) queryClient.setQueryData(["reviews", bookId], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reviews", bookId] }),
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
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Review;
          queryClient.setQueryData<Review[]>(["reviews", bookId], (old) => {
            if (!old || !row?.id) return old;
            if (payload.eventType === "DELETE") return old.filter((review) => review.id !== row.id);
            const existing = old.find((review) => review.id === row.id);
            return existing
              ? old.map((review) => review.id === row.id ? { ...review, ...row } : review)
              : [row, ...old];
          });
          // Los joins de perfil no vienen en WAL; se confirman sin bloquear el cambio visible.
          void queryClient.invalidateQueries({ queryKey: ["reviews", bookId], refetchType: "active" });
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
