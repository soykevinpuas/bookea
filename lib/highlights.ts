import { createClientClient } from "@/lib/supabase";
import { Highlight } from "@/types/reading";

// 4.3 - Acceso a Datos (DAO) para interactuar con la sub-entidad de Subrayados y Notas (Highlights)

export async function getHighlights(
  bookId: string,
  userId: string
): Promise<Highlight[]> {
  try {
    const supabase = createClientClient();
    const { data, error } = await supabase
      .from("highlights")
      .select("*")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function saveHighlight(
  bookId: string,
  userId: string,
  cfiStart: string,
  cfiEnd: string,
  text: string,
  color: string,
  note?: string
): Promise<Highlight | null> {
  try {
    const supabase = createClientClient();
    
    // El insert retorna el registro creado, útil para añadirlo al estado UI
    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: userId,
        book_id: bookId,
        cfi_start: cfiStart,
        cfi_end: cfiEnd,
        text,
        color,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.warn("Highlight save error:", error.message);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export async function updateHighlightNote(
  highlightId: string,
  note: string
): Promise<boolean> {
  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("highlights")
      .update({ note })
      .eq("id", highlightId);

    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

export async function updateHighlightColor(
  highlightId: string,
  color: string
): Promise<boolean> {
  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("highlights")
      .update({ color })
      .eq("id", highlightId);

    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

export async function deleteHighlight(
  highlightId: string
): Promise<boolean> {
  try {
    const supabase = createClientClient();
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", highlightId);

    if (error) return false;
    return true;
  } catch {
    return false;
  }
}
