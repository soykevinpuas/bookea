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
    // 3.4.1 - Cambiado !inner por left join (removiendo !inner) para que los libros aparezcan 
    // aunque no se haya inicializado su record de progreso aún.
    const { data, error } = await supabase
      .from("user_books")
      .select(`
        books(*),
        reading_progress(last_read_at, percent_complete, cfi_position)
      `)
      .eq("user_id", userId);

    if (error) {
      console.warn("Using offline fallback due to Supabase error:", error.message);
      return getAllCachedBooks();
    }

    if (!data || !Array.isArray(data)) return getAllCachedBooks();

    const books = data
      .map((item: any) => {
        const bookData = item.books;
        const book = Array.isArray(bookData) ? bookData[0] : bookData;
        if (!book) return null;

        // Búsqueda de progreso: Intentar encontrar el registro que corresponde a este libro
        // Con el nuevo join, ya viene filtrado por el query si la relación está bien definida,
        // pero aseguramos que el progreso pertenezca al usuario por si acaso.
        const progressEntries = item.reading_progress || [];
        const progressEntry = Array.isArray(progressEntries) ? progressEntries[0] : progressEntries;
        
        let serverPercent = progressEntry?.percent_complete || 0;
        let serverCfi = progressEntry?.cfi_position || null;
        let lastRead = progressEntry?.last_read_at || null;

        // 3.4.1.9 - PRIORIDAD OFFLINE: Si lo local es más nuevo, lo usamos para la card
        let local = null;
        try {
          const rawLocal = typeof window !== 'undefined' ? localStorage.getItem("bookea-offline-progress") : null;
          if (rawLocal) {
            const allLocal = JSON.parse(rawLocal);
            local = allLocal[book.id];
          }
        } catch (e) {
          console.warn("Error parsing local progress in getUserBooks:", e);
        }
        
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
        
        // 3.4.1.9.1 - ESTADO DE DESCARGA
        const offlineMeta = getCachedBookMetadata(book.id);
        const isOfflineReady = offlineMeta ? (offlineMeta as any).isOfflineReady : false;

        return { 
          ...book, 
          last_read_at: finalLastRead,
          percent_complete: finalPercent,
          isOfflineReady
        };
      })
      .filter((b): b is Book => !!b && typeof b === 'object' && 'id' in b);

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

    if (options?.author) {
      const authorLower = options.author.toLowerCase();
      result = result.filter(book => book.author?.toLowerCase().includes(authorLower));
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
 * Se usa cuando un suscriptor premium abre un libro del catálogo.
 */
export async function addToLibrary(supabase: SupabaseClient, userId: string, bookId: string, accessType: 'subscription' | 'permanent' = 'subscription') {
  if (!userId || !bookId) return null;

  try {
    // 1. Upsert en user_books
    const { data, error } = await supabase
      .from("user_books")
      .upsert({ 
        user_id: userId, 
        book_id: bookId, 
        access_type: accessType 
      }, { onConflict: 'user_id,book_id' })
      .select()
      .maybeSingle();

    if (error) throw error;
    
    // 2. Asegurar que exista el registro de progreso (necesario para el join en getUserBooks)
    await supabase
      .from("reading_progress")
      .upsert({ 
        user_id: userId, 
        book_id: bookId,
        percent_complete: 0,
        last_read_at: new Date().toISOString()
      }, { onConflict: 'user_id,book_id' });

    return data;
  } catch (error) {
    console.error("Error adding book to library:", error);
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


