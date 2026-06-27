import { SupabaseClient } from "@supabase/supabase-js";
import { Book } from "@/types/book";
import { getCachedBookMetadata, getAllCachedBooks, saveBookMetadata } from "./downloads";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

// 3.3 - Configuración y Utilerías de Acceso a Supabase para la Entidad Books
export async function getBooks(
  supabase: SupabaseClient, 
  filters?: { search?: string; category?: string; author?: string; adminId?: string }
): Promise<Book[]> {
  try {
    let query = supabase
      .from("books")
      .select("*")
      .eq("is_active", true);

    // Si se especifica adminId, filtrar por admin_stock en vez de stock_physical global
    if (filters?.adminId) {
      const { data: adminStock } = await supabase
        .from("admin_stock")
        .select("book_id")
        .eq("admin_id", filters.adminId)
        .gt("quantity", 0);

      const adminBookIds = (adminStock ?? []).map(s => s.book_id);

      if (adminBookIds.length > 0) {
        // Columna en books es "id", no "book_id" (book_id solo existe en admin_stock)
        query = query.or(`epub_url.not.is.null,id.in.(${adminBookIds.join(',')})`);
      } else {
        query = query.not("epub_url", "is", null);
      }
    } else {
      // Free/subscriber: digitales siempre; físicos solo si hay stock en almacén (suma admin_stock)
      query = query.or("epub_url.not.is.null,stock_physical.gt.0");
    }

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
  } catch {
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
    // 1. Obtener los libros en la biblioteca del usuario
    const { data: userBooksData, error: ubError } = await supabase
      .from("user_books")
      .select(`
        access_type,
        expires_at,
        book_id,
        books(*)
      `)
      .eq("user_id", userId);

    if (ubError) {
      console.warn("Supabase error in user_books fetch:", ubError.message);
      return getAllCachedBooks();
    }

    if (!userBooksData || !Array.isArray(userBooksData)) return getAllCachedBooks();

    // 2. Obtener el progreso de lectura por separado para evitar errores de relación
    const { data: progressData } = await supabase
      .from("reading_progress")
      .select("book_id, last_read_at, percent_complete, cfi_position")
      .eq("user_id", userId);

    // Crear un mapa de progreso para búsqueda rápida O(1)
    const progressMap = new Map();
    progressData?.forEach(p => {
      progressMap.set(p.book_id, p);
    });

    const books = userBooksData
      .map((item: { access_type: string; expires_at?: string | null; book_id: string; books: Book | Book[] }) => {
        const bookData = item.books;
        const book = Array.isArray(bookData) ? bookData[0] : bookData;
        
        if (!book || !book.id) return null;

        const progressEntry = progressMap.get(book.id);
        
        const serverPercent = progressEntry?.percent_complete || 0;
        const lastRead = progressEntry?.last_read_at || null;

        // 3.4.1.9 - PRIORIDAD OFFLINE
        let local = null;
        try {
          const rawLocal = typeof window !== 'undefined' ? localStorage.getItem("bookea-offline-progress") : null;
          if (rawLocal) {
            const allLocal = JSON.parse(rawLocal);
            local = allLocal[`${userId}:${book.id}`] || allLocal[book.id];
            if (local?.user_id && local.user_id !== userId) local = null;
          }
        } catch {}
        
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
          access_type: item.access_type,
          expires_at: item.expires_at ?? null,
          isOfflineReady
        };
      })
      .filter((b): b is NonNullable<typeof b> => !!b);

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

    return result as Book[];
  } catch {
    return getAllCachedBooks();
  }
}

const ACCESS_CACHE_KEY = 'bookea-access-cache';
const ACCESS_CACHE_TTL = 5 * 60 * 1000;

function getAccessCacheKey(userId: string, bookId: string): string {
  return `${userId}:${bookId}`;
}

function getCachedAccess(userId: string, bookId: string): boolean | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_CACHE_KEY) : null;
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const cacheKey = getAccessCacheKey(userId, bookId);
    const entry = cache[cacheKey];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ACCESS_CACHE_TTL) {
      delete cache[cacheKey];
      localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry.hasAccess ?? null;
  } catch {
    return null;
  }
}

function setCachedAccess(userId: string, bookId: string, hasAccess: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(ACCESS_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[getAccessCacheKey(userId, bookId)] = { hasAccess, cachedAt: Date.now() };
    localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be full or unavailable
  }
}

export async function hasBookAccess(supabase: SupabaseClient, userId: string, bookId: string): Promise<boolean> {
  if (!userId || !bookId) return false;
  
  try {
    // 1. Obtener datos del usuario (rol y fin de suscripción)
const { data: userData, error: userError } = await supabase
  .from("users")
  .select("role, subscription_ends_at")
  .eq("id", userId)
  .single();

if (userError || !userData) {
  console.error('[hasBookAccess] Error al consultar usuario:', userError?.message);
  const cached = getCachedAccess(userId, bookId);
  if (cached !== null) return cached;
  return false;
}

    // Administradores y vendedores tienen acceso total al catálogo digital
    if (userData.role === 'admin' || userData.role === 'vendedor') return true;

    // Verificar si es Premium activo
    const now = new Date();
    const endsAt = userData.subscription_ends_at ? new Date(userData.subscription_ends_at) : null;
    const isPremiumActive = userData.role === 'subscriber' && (!endsAt || endsAt > now);

    // 2. Obtener datos del libro para ver si es Premium
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("is_premium, title")
      .eq("id", bookId)
      .single();

    if (!book || bookError) {
      const cached = getCachedAccess(userId, bookId);
      if (cached !== null) return cached;
      console.warn(`[hasBookAccess] Error obteniendo libro ${bookId}:`, bookError);
      return false;
    }

    // --- REGLA DE ORO DE LIBROS GRATIS ---
    // Si el libro NO es premium, cualquier usuario (incluso gratis) puede leerlo.
    if (!book.is_premium) {
      setCachedAccess(userId, bookId, true);
      return true;
    }

    // --- REGLA DE LIBROS PREMIUM ---
    // Si el usuario es Premium activo y el libro es Premium, permitir acceso
    if (isPremiumActive && book.is_premium) {
      setCachedAccess(userId, bookId, true);
      return true;
    }
    
    // 3. Verificar acceso específico en biblioteca (Compras permanentes, regalos, o canjes con monedas)
    const { data: userBook } = await supabase
      .from("user_books")
      .select("access_type, expires_at")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (userBook) {
      if (userBook.access_type === 'permanent' || userBook.access_type === 'gift') {
        setCachedAccess(userId, bookId, true);
        return true;
      }
      if (userBook.access_type === 'subscription' && isPremiumActive) {
        setCachedAccess(userId, bookId, true);
        return true;
      }
      if (userBook.access_type === 'coin_redemption') {
        const expiresAt = userBook.expires_at ? new Date(userBook.expires_at) : null;
        if (expiresAt && expiresAt > now) {
          setCachedAccess(userId, bookId, true);
          return true;
        }
      }
    }

    setCachedAccess(userId, bookId, false);
    console.warn(`[hasBookAccess] Acceso DENEGADO: ${book.title}. UserRole=${userData.role}, isPremiumActive=${isPremiumActive}`);
    return false;
  } catch (error) {
    const cached = getCachedAccess(userId, bookId);
    if (cached !== null) return cached;
    console.error("Error checking book access:", error);
    return false;
  }
}

/**
 * 3.3.4 - Agregar un libro a la biblioteca del usuario.
 * Verifica existencia antes de insertar y nunca degrada accesos fuertes
 * (compras permanentes, regalos o canjes vigentes).
 */
export type LibraryAccessType = 'subscription' | 'permanent' | 'gift' | 'coin_redemption';

const ACCESS_STRENGTH: Record<LibraryAccessType, number> = {
  subscription: 1,
  coin_redemption: 2,
  permanent: 3,
  gift: 3,
};

function shouldUpdateLibraryAccess(
  existing: { access_type: LibraryAccessType; expires_at?: string | null },
  requestedAccessType: LibraryAccessType
) {
  const now = new Date();
  const existingExpiresAt = existing.expires_at ? new Date(existing.expires_at) : null;
  const existingIsExpiredCoin =
    existing.access_type === 'coin_redemption' &&
    (!existingExpiresAt || existingExpiresAt <= now);

  if (!existingIsExpiredCoin && ACCESS_STRENGTH[existing.access_type] >= ACCESS_STRENGTH[requestedAccessType]) {
    return false;
  }

  return true;
}

export async function addToLibrary(supabase: SupabaseClient, userId: string, bookId: string, accessType: LibraryAccessType = 'subscription') {
  if (!userId || !bookId) return null;

  try {
    // 1. Verificar si ya existe para evitar errores de duplicidad/constraint
    const { data: existing, error: checkError } = await supabase
      .from("user_books")
      .select("id, access_type, expires_at")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (checkError) {
      console.error("[addToLibrary] Check error:", checkError);
      throw new Error(`Database check error: ${checkError.message}`);
    }

    let record;
    if (existing) {
      if (!shouldUpdateLibraryAccess(existing as { access_type: LibraryAccessType; expires_at?: string | null }, accessType)) {
        record = existing;
      } else {
      const { data, error: updateError } = await supabase
        .from("user_books")
        .update({ access_type: accessType, expires_at: null })
        .eq("id", existing.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("[addToLibrary] Update error:", updateError);
        throw new Error(`Update failed: ${updateError.message}`);
      }
      record = data;
      }
    } else {
      // Si no existe, insertar
      const { data, error: insertError } = await supabase
        .from("user_books")
        .insert({ 
          user_id: userId, 
          book_id: bookId, 
          access_type: accessType 
        })
        .select()
        .single();

      if (insertError) {
      console.error("[addToLibrary] ERROR DE SUPABASE AL INSERTAR:", insertError.message, insertError.details, insertError.hint);
      throw new Error(`Error de base de datos: ${insertError.message}`);
    }
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
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : 'Error desconocido';
  console.error("Critical error in addToLibrary:", msg);
  return { error: "Error desconocido" };
}
}

/**
 * 3.3.5 - Quitar un libro de la biblioteca personal.
 */
export async function removeFromLibrary(supabase: SupabaseClient, userId: string, bookId: string) {
  if (!userId || !bookId) return { success: false, error: "Datos incompletos" };

  try {
    const { data: entry, error: entryError } = await supabase
      .from("user_books")
      .select("id, access_type, books(is_premium, price_digital)")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (entryError) throw entryError;
    if (!entry) return { success: true };

    const bookData = Array.isArray(entry.books) ? entry.books[0] : entry.books;
    const isFreePermanent =
      entry.access_type === "permanent" &&
      bookData?.is_premium === false &&
      Number(bookData?.price_digital || 0) <= 0;

    if (entry.access_type !== "subscription" && !isFreePermanent) {
      return {
        success: false,
        error: "Este acceso es una compra, regalo o canje activo y no se puede eliminar desde la biblioteca.",
      };
    }

    const { error } = await supabase
      .from("user_books")
      .delete()
      .eq("id", entry.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error removing book from library:", error);
    return { success: false, error: "Error al quitar el libro de la biblioteca" };
  }
}
