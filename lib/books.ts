import { SupabaseClient } from "@supabase/supabase-js";
import type { Book, BookAccessType } from "@/types/book";
import { getCachedBookMetadata, getAllCachedBooks, isBookDownloaded, saveBookMetadata } from "./downloads";

// Modulo central de catalogo, biblioteca y reglas de acceso digital.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);
const VALID_LIBRARY_ACCESS_TYPES: BookAccessType[] = ["subscription", "permanent", "gift", "coin_redemption"];

function normalizeLibraryAccessType(accessType: string | null | undefined): BookAccessType | null {
  return VALID_LIBRARY_ACCESS_TYPES.includes(accessType as BookAccessType)
    ? accessType as BookAccessType
    : null;
}

// Lista libros activos aplicando filtros de catalogo y visibilidad fisica/digital.
export async function getBooks(
  supabase: SupabaseClient,
  filters?: { search?: string; category?: string; author?: string; adminId?: string }
): Promise<Book[]> {
  try {
    let query = supabase
      .from("books")
      .select("*")
      .eq("is_active", true);

    // Admin ve fisicos disponibles en su propio stock; usuarios ven stock agregado.
    if (filters?.adminId) {
      const { data: adminStock } = await supabase
        .from("admin_stock")
        .select("book_id")
        .eq("admin_id", filters.adminId)
        .gt("quantity", 0);

      const adminBookIds = (adminStock ?? []).map(s => s.book_id);

      if (adminBookIds.length > 0) {
        query = query.or(`epub_url.not.is.null,id.in.(${adminBookIds.join(',')})`);
      } else {
        query = query.not("epub_url", "is", null);
      }
    } else {
      query = query.or("epub_url.not.is.null,stock_physical.gt.0");
    }

    if (filters?.search) {
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

// Obtiene un libro activo por UUID y cae al cache local si no hay red.
export async function getBook(supabase: SupabaseClient, id: string): Promise<Book | null> {
  if (!id || !isValidUUID(id)) return null;

  try {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error) {
      return getCachedBookMetadata(id);
    }
    return (data as Book) || null;
  } catch {
    return getCachedBookMetadata(id);
  }
}

// Devuelve la biblioteca del usuario, combinando Supabase con progreso/cache offline.
export async function getUserBooks(supabase: SupabaseClient, userId: string, options?: { search?: string; category?: string; author?: string }): Promise<Book[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return getAllCachedBooks();
  }

  if (!userId) return getAllCachedBooks();

  try {
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

    // El progreso se consulta aparte porque la relacion historica no siempre existe.
    const { data: progressData } = await supabase
      .from("reading_progress")
      .select("book_id, last_read_at, percent_complete, cfi_position")
      .eq("user_id", userId);

    const progressMap = new Map();
    progressData?.forEach(p => {
      progressMap.set(p.book_id, p);
    });

    const books = (await Promise.all(
      userBooksData.map(async (item: { access_type: string | null; expires_at?: string | null; book_id: string; books: Book | Book[] }) => {
        const bookData = item.books;
        const book = Array.isArray(bookData) ? bookData[0] : bookData;

        if (!book || !book.id) return null;

        const progressEntry = progressMap.get(book.id);

        const serverPercent = progressEntry?.percent_complete || 0;
        const lastRead = progressEntry?.last_read_at || null;

        // El progreso local puede ser mas fresco si el usuario leyo offline.
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

        const isOfflineReady = await isBookDownloaded(book.id, book.epub_url);

        return {
          ...book,
          last_read_at: finalLastRead,
          percent_complete: finalPercent,
          access_type: normalizeLibraryAccessType(item.access_type),
          expires_at: item.expires_at ?? null,
          isOfflineReady
        };
      })
    ))
      .filter((b): b is NonNullable<typeof b> => !!b);

    // Mantiene metadata disponible para biblioteca offline.
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

// Cachea solo el resultado booleano por usuario/libro; nunca roles ni privilegios.
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
    // localStorage puede estar lleno o bloqueado por privacidad.
  }
}

// Determina si un usuario puede leer un libro premium/free con fallback offline seguro.
export async function hasBookAccess(supabase: SupabaseClient, userId: string, bookId: string): Promise<boolean> {
  if (!userId || !bookId) return false;

  try {
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

    // Admin/vendedor necesitan acceso operativo al catalogo digital.
    if (userData.role === 'admin' || userData.role === 'vendedor') return true;

    const now = new Date();
    const endsAt = userData.subscription_ends_at ? new Date(userData.subscription_ends_at) : null;
    const isPremiumActive = userData.role === 'subscriber' && (!endsAt || endsAt > now);

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

    // Libro no premium: cualquier usuario autenticado puede leerlo.
    if (!book.is_premium) {
      setCachedAccess(userId, bookId, true);
      return true;
    }

    // Libro premium: subscriber activo entra por plan.
    if (isPremiumActive && book.is_premium) {
      setCachedAccess(userId, bookId, true);
      return true;
    }

    // Accesos explicitos cubren compras permanentes, regalos y canjes vigentes.
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
 * Tipos de acceso guardados en user_books y usados por lector/catalogo.
 */
export type LibraryAccessType = BookAccessType;

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

// Agrega o actualiza biblioteca sin degradar accesos mas fuertes ya existentes.
export async function addToLibrary(supabase: SupabaseClient, userId: string, bookId: string, accessType: LibraryAccessType = 'subscription') {
  if (!userId || !bookId) return null;

  try {
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

    // El dashboard espera que exista progreso para ordenar y mostrar el libro.
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

// Quita accesos removibles sin permitir borrar compras, regalos o canjes activos.
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
