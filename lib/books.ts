import { SupabaseClient } from "@supabase/supabase-js";
import { Book } from "@/types/book";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

// 3.3 - Configuración y Utilerías de Acceso a Supabase para la Entidad Books
export async function getBooks(
  supabase: SupabaseClient, 
  filters?: { search?: string; category?: string }
): Promise<Book[]> {
  try {
    let query = supabase
      .from("books")
      .select("*")
      .eq("is_active", true);

    if (filters?.search) {
      // Búsqueda simple en título o autor
      query = query.or(`title.ilike.%${filters.search}%,author.ilike.%${filters.search}%`);
    }

    if (filters?.category && filters.category !== "all") {
      query = query.eq("category", filters.category);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase error fetching books:", error.message);
      return [];
    }

    return Array.isArray(data) ? (data as Book[]) : [];
  } catch (error) {
    console.error("Exception fetching books:", error);
    return [];
  }
}

export async function getBook(supabase: SupabaseClient, id: string): Promise<Book | null> {
  if (!id) return null;
  if (!id || !isValidUUID(id)) return null;
  
  try {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error) return null;
    return (data as Book) || null;
  } catch (error) {
    return null;
  }
}

export async function getUserBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  if (!userId) return [];
  
  try {
    const { data, error } = await supabase
      .from("user_books")
      .select("books(*)")
      .eq("user_id", userId);

    if (error) {
      console.warn("Supabase error fetching user_books:", error.message);
      return [];
    }

    if (!data || !Array.isArray(data)) return [];

    return data
      .map((item: any) => {
        // 3.3.1 - Aplanar matriz/objeto anidado devuelto por la API de Supabase para asegurar mapeo de Typescript
        const bookData = item.books;
        if (Array.isArray(bookData)) return bookData[0];
        return bookData;
      })
      .filter((b): b is Book => !!b && typeof b === 'object' && 'id' in b);
  } catch (error) {
    console.warn("Error in getUserBooks logic");
    return [];
  }
}

export async function hasBookAccess(supabase: SupabaseClient, userId: string, bookId: string): Promise<boolean> {
  if (!userId || !bookId) return false;
  
  try {
    const { data, error } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (error) return false;
    return !!(data && typeof data === 'object' && 'id' in data);
  } catch (error) {
    return false;
  }
}


