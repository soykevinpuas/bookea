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

// UUID v4 format check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

export async function saveReadingProgress(
  bookId: string,
  userId: string,
  cfiPosition: string,
  percentComplete: number
): Promise<void> {
  // If not a valid UUID (e.g. mock books "1", "2"), don't save to DB
  if (!isValidUUID(bookId)) return;

  try {
    const supabase = createClientClient();

    // Round to 2 decimal places to fit NUMERIC(5,2) in Postgres
    const cleanPercent = Math.min(100, Math.max(0, Math.round(percentComplete * 100) / 100));

    const { error } = await supabase.from("reading_progress").upsert(
      {
        user_id: userId,
        book_id: bookId,
        cfi_position: cfiPosition,
        percent_complete: cleanPercent,
        last_read_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,book_id",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      if (error.code !== "23503") {
        console.warn("Reading progress save error:", error.message, "code:", error.code);
      }
    }
  } catch {
    // Silently fail to not interrupt reading
  }
}

