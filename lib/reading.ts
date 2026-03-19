import { createClientClient } from "@/lib/supabase";
import { ReadingProgress } from "@/types/reading";

export async function getReadingProgress(
  bookId: string,
  userId: string
): Promise<ReadingProgress | null> {
  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveReadingProgress(
  bookId: string,
  userId: string,
  cfiPosition: string,
  percentComplete: number
): Promise<void> {
  try {
    const supabase = createClientClient();

    const { error } = await supabase.from("reading_progress").upsert(
      {
        user_id: userId,
        book_id: bookId,
        cfi_position: cfiPosition,
        percent_complete: percentComplete,
        last_read_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,book_id",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      // Silently skip if user record doesn't exist yet in public.users
      // (happens on very first login before the DB trigger fires)
      if (error.code !== "23503") {
        console.warn("Reading progress save error:", error.message, "code:", error.code);
      }
    }
  } catch {
    // Never crash the reader over a progress save failure
  }
}
