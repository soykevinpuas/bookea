import { SupabaseClient } from "@supabase/supabase-js";
import { Book } from "@/types/book";
import { getCachedBookMetadata, getAllCachedBooks, saveBookMetadata } from "./downloads";

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

    if (error) {
      // FALLBACK OFFLINE: Si no hay internet, intentar obtener del caché local
      return getCachedBookMetadata(id);
    }
    return (data as Book) || null;
  } catch (error) {
    // FALLBACK OFFLINE: En caso de error de red (fetch fallido)
    return getCachedBookMetadata(id);
  }
}

export async function getUserBooks(supabase: SupabaseClient, userId: string, options?: { search?: string; category?: string }): Promise<Book[]> {
  // 1. Si estamos offline (chequeo rápido de navegador), vamos directo al grano
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return getAllCachedBooks();
  }

  if (!userId) return getAllCachedBooks(); // Devolver caché incluso si no hay ID por ahora
  
  try {
    const { data, error } = await supabase
      .from("user_books")
      .select(`
        books(*),
        reading_progress:book_id(reading_progress(last_read_at))
      `)
      .eq("user_id", userId);

    if (error) {
      console.warn("Using offline fallback due to Supabase error");
      return getAllCachedBooks();
    }

    if (!data || !Array.isArray(data)) return getAllCachedBooks();

    const books = data
      .map((item: any) => {
        const bookData = item.books;
        const book = Array.isArray(bookData) ? bookData[0] : bookData;
        
        const progress = item.reading_progress;
        const progressData = Array.isArray(progress) ? progress[0] : progress;
        const lastRead = progressData?.reading_progress?.[0]?.last_read_at || null;
        
        return { ...book, last_read_at: lastRead };
      })
      .filter((b): b is Book & { last_read_at: string | null } => !!b && typeof b === 'object' && 'id' in b);

    // 3.4.2 - AUTO-CACHING: Guardar todo lo que traemos de la nube para el futuro
    if (books.length > 0) {
      books.forEach(b => saveBookMetadata(b));
    }

    // 3.3.2 - Ordenar y filtrar
    let result = [...books];
    result.sort((a, b) => {
      if (!a.last_read_at) return 1;
      if (!b.last_read_at) return -1;
      return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime();
    });

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      result = result.filter(book => 
        book.title?.toLowerCase().includes(searchLower) || 
        book.author?.toLowerCase().includes(searchLower)
      );
    }

    if (options?.category && options.category !== "all") {
      result = result.filter(book => book.category === options.category);
    }

    return result;
  } catch (error) {
    return getAllCachedBooks();
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


