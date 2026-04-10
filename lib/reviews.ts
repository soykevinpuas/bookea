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

// 7.1 - Obtener todas las reseñas de un libro específico
export async function getBookReviews(bookId: string): Promise<Review[]> {
  const supabase = createClientClient();
  
  // Realizamos la consulta simplificada para evitar errores de relación ambiguos
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

  if (error) {
    console.error("Error al obtener reseñas:", error.message);
    return [];
  }
  
  return data as Review[];
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
