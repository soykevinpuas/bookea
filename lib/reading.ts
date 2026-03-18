import { createClientClient } from "@/lib/supabase";
import { ReadingProgress } from "@/types/reading";

export async function getReadingProgress(
  bookId: string,
  userId: string
): Promise<ReadingProgress | null> {
  const supabase = createClientClient();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function saveReadingProgress(
  bookId: string,
  userId: string,
  cfiPosition: string,
  percentComplete: number
): Promise<void> {
  const supabase = createClientClient();
  
  try {
    // Attempt to update first (safest method if unique constraints are missing)
    const { data: existing, error: fetchError } = await supabase
      .from("reading_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn("Supabase check error (reading_progress might not exist):", fetchError.message);
      return; 
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("reading_progress")
        .update({
          cfi_position: cfiPosition,
          percent_complete: percentComplete,
          last_read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("book_id", bookId);
        
      if (updateError) console.warn("Error updating reading progress:", updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from("reading_progress")
        .insert({
          user_id: userId,
          book_id: bookId,
          cfi_position: cfiPosition,
          percent_complete: percentComplete,
          last_read_at: new Date().toISOString(),
        });
        
      if (insertError) console.warn("Error inserting reading progress:", insertError.message);
    }
  } catch (e: any) {
    console.error("Unexpected error saving reading progress:", e.message || e);
  }
}
