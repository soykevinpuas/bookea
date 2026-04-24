import { SupabaseClient } from "@supabase/supabase-js";
import { Book } from "@/types/book";
import { getCachedBookMetadata, getAllCachedBooks, saveBookMetadata } from "./downloads";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

// 3.3 - Configuración y Utilerías de Acceso a Supabase para la Entidad Books
export async function getBooks(
  supabase: SupabaseClient, 
  filters?: { search?: string; category?: string; author?: string }
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

    if (filters?.author) {
      query = query.ilike("author", `%${filters.author}%`);
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

export async function getUserBooks(supabase: SupabaseClient, userId: string, options?: { search?: string; category?: string; author?: string }): Promise<Book[]> {
  // 1. Si estamos offline (chequeo rápido de navegador), vamos directo al grano
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return getAllCachedBooks();
  }

  if (!userId) return getAllCachedBooks(); // Devolver caché incluso si no hay ID por ahora
  
  try {
    // 3.4.1 - Cambiado !inner por left join (removiendo !inner)
    // El select books(*) trae el registro del libro asociado.
    const { data, error } = await supabase
      .from("user_books")
      .select(`
        books(*),
        reading_progress(last_read_at, percent_complete, cfi_position)
      `)
      .eq("user_id", userId);

    if (error) {
      console.warn("Supabase error in getUserBooks:", error.message);
      return getAllCachedBooks();
    }

    if (!data || !Array.isArray(data)) return getAllCachedBooks();

    const books = data
      .map((item: any) => {
        const book = item.books;
        if (!book) return null;

        // Búsqueda de progreso: Con left join, viene como array o nulo
        const progressEntries = item.reading_progress;
        const progressEntry = Array.isArray(progressEntries) ? progressEntries[0] : progressEntries;
        
        let serverPercent = progressEntry?.percent_complete || 0;
        let lastRead = progressEntry?.last_read_at || null;

        // 3.4.1.9 - PRIORIDAD OFFLINE
        let local = null;
        try {
          const rawLocal = typeof window !== 'undefined' ? localStorage.getItem("bookea-offline-progress") : null;
          if (rawLocal) {
            const allLocal = JSON.parse(rawLocal);
            local = allLocal[book.id];
          }
        } catch (e) {}
        
        let finalPercent = serverPercent;
        let finalLastRead = lastRead;
        
        if (local && (local.updated_at || local.last_read_at)) {
          const localTimestamp = local.updated_at || local.last_read_at;
          const sTime = lastRead ? new Date(lastRead).getTime() : 0;
          const lTime = new Date(localTimestamp).getTime();
          
          if (lTime > sTime) {
            finalPercent = local.percent_complete ?? serverPercent;
            finalLastRead = localTimestamp;
          }
        }
        
        const isOfflineReady = getCachedBookMetadata(book.id) ? true : false;

        return { 
          ...book, 
          last_read_at: finalLastRead,
          percent_complete: finalPercent,
          isOfflineReady
        };
      })
      .filter((b): b is Book => !!b);

    // 3.4.2 - AUTO-CACHING
    if (books.length > 0) {
      books.forEach(b => saveBookMetadata(b));
    }

    let result = [...books];
    result.sort((a, b) => {
      const timeA = a.last_read_at ? new Date(a.last_read_at).getTime() : 0;
      const timeB = b.last_read_at ? new Date(b.last_read_at).getTime() : 0;
      return timeB - timeA;
    });

    if (options?.search) {
      const s = options.search.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s));
    }

    if (options?.category && options.category !== "all") {
      result = result.filter(b => b.category === options.category);
    }

    return result;
  } catch (error) {
    return getAllCachedBooks();
  }
}

export async function hasBookAccess(supabase: SupabaseClient, userId: string, bookId: string): Promise<boolean> {
  if (!userId || !bookId) return false;
  
  try {
    // 1. Verificar el rol del usuario primero para bypass de admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, subscription_ends_at")
      .eq("id", userId)
      .single();

    if (userError || !userData) return false;

    // Administradores tienen acceso total SIEMPRE
    if (userData.role === 'admin') return true;

    // 2. Para otros usuarios, verificar si el libro está en su biblioteca
    const { data: userBook, error: ubError } = await supabase
      .from("user_books")
      .select(`
        id,
        access_type
      `)
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    // Si no tiene el libro en la biblioteca, no tiene acceso (a menos que sea admin, ya manejado arriba)
    if (ubError || !userBook) return false;

    const accessType = userBook.access_type;

    // 3. Acceso Permanente o Regalo siempre es TRUE
    if (accessType === 'permanent' || accessType === 'gift') {
      return true;
    }

    // 4. Acceso por Suscripción requiere validación de Premium activo
    if (accessType === 'subscription') {
      const now = new Date();
      const endsAt = userData.subscription_ends_at ? new Date(userData.subscription_ends_at) : null;
      
      const isPremium = userData.role === 'subscriber' && 
                       (!endsAt || endsAt > now);
      
      return isPremium;
    }

    return false;
  } catch (error) {
    console.error("Error checking book access:", error);
    return false;
  }
}

/**
 * 3.3.4 - Agregar un libro a la biblioteca del usuario.
 * Versión ultra-robusta que verifica existencia antes de insertar.
 */
export async function addToLibrary(supabase: SupabaseClient, userId: string, bookId: string, accessType: 'subscription' | 'permanent' = 'subscription') {
  if (!userId || !bookId) return null;

  try {
    // 1. Verificar si ya existe para evitar errores de duplicidad/constraint
    const { data: existing } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    let record;
    if (existing) {
      // Si existe, actualizar el access_type por si acaso
      const { data } = await supabase
        .from("user_books")
        .update({ access_type: accessType })
        .eq("id", existing.id)
        .select()
        .single();
      record = data;
    } else {
      // Si no existe, insertar
      const { data, error } = await supabase
        .from("user_books")
        .insert({ 
          user_id: userId, 
          book_id: bookId, 
          access_type: accessType 
        })
        .select()
        .single();
      if (error) throw error;
      record = data;
    }
    
    // 2. Asegurar que exista el registro de progreso (necesario para el join)
    const { data: existingProgress } = await supabase
      .from("reading_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (!existingProgress) {
      await supabase
        .from("reading_progress")
        .insert({ 
          user_id: userId, 
          book_id: bookId,
          percent_complete: 0,
          last_read_at: new Date().toISOString()
        });
    }

    return record;
  } catch (error) {
    console.error("Critical error in addToLibrary:", error);
    return null;
  }
}

/**
 * 3.3.5 - Quitar un libro de la biblioteca personal.
 */
export async function removeFromLibrary(supabase: SupabaseClient, userId: string, bookId: string) {
  if (!userId || !bookId) return false;

  try {
    const { error } = await supabase
      .from("user_books")
      .delete()
      .eq("user_id", userId)
      .eq("book_id", bookId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error removing book from library:", error);
    return false;
  }
}


