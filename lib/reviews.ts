import { createClientClient } from "@/lib/supabase";

export interface Review {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url: string;
  };
}

const REVIEWS_CACHE_KEY = 'bookea-offline-reviews';

/**
 * 7.0.1 - Guardar reviews localmente para acceso offline
 */
export function saveLocalReviews(bookId: string, reviews: Review[]) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(REVIEWS_CACHE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    // Solo guardamos los últimos 10 para no saturar el localStorage
    all[bookId] = reviews.slice(0, 10);
    localStorage.setItem(REVIEWS_CACHE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error("Error al guardar reviews locales:", err);
  }
}

/**
 * 7.0.2 - Obtener reviews del caché local
 */
export function getLocalReviews(bookId: string): Review[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REVIEWS_CACHE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all[bookId] || [];
  } catch {
    return [];
  }
}

// 7.1 - Obtener todas las reseñas de un libro específico
export async function getBookReviews(bookId: string): Promise<Review[]> {
  const local = getLocalReviews(bookId);
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return local;
  }

  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        *,
        profiles (
          name,
          avatar_url
        )
      `)
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (error) return local;

    // Auto-cache al obtener online
    if (data) {
      saveLocalReviews(bookId, data as Review[]);
    }

    return (data as Review[]) || local;
  } catch {
    return local;
  }
}

// 7.2 - Guardar o actualizar una reseña de usuario
export async function saveReview(
  bookId: string,
  userId: string,
  rating: number,
  content: string
): Promise<Review | null> {
  const supabase = createClientClient();
  
  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        user_id: userId,
        book_id: bookId,
        rating,
        content,
      },
      { onConflict: "user_id,book_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving review:", error);
    return null;
  }

  return data as Review;
}

// 7.3 - Eliminar una reseña propia
export async function deleteReview(reviewId: string): Promise<boolean> {
  const supabase = createClientClient();
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId);

  if (error) {
    console.error("Error deleting review:", error);
    return false;
  }
  return true;
}
