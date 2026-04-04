import { createClientClient } from "@/lib/supabase";

/**
 * 6.5 - Reseñas: Lógica de acceso a datos y suscripciones en tiempo real
 */

export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  rating: number;
  content: string;
  created_at: string;
  profiles: {
    name: string | null;
    avatar_url: string | null;
  };
}

export async function getBookReviews(bookId: string): Promise<Review[]> {
  const supabase = createClientClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      profiles:user_id (
        name,
        avatar_url
      )
    `)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
  return data as any as Review[];
}

export async function saveReview(
  bookId: string,
  userId: string,
  rating: number,
  content: string
): Promise<boolean> {
  const supabase = createClientClient();
  
  const { error } = await supabase
    .from("reviews")
    .upsert(
      {
        book_id: bookId,
        user_id: userId,
        rating,
        content,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,book_id" }
    );

  if (error) {
    console.error("Error saving review:", error);
    return false;
  }
  return true;
}

export async function deleteReview(reviewId: string): Promise<boolean> {
  const supabase = createClientClient();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  return !error;
}
