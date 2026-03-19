import { SupabaseClient } from "@supabase/supabase-js";
import { Book } from "@/types/book";

export const MOCK_BOOKS: Book[] = [
  {
    id: "1",
    title: "El Principito",
    author: "Antoine de Saint-Exupéry",
    description: "Un clásico de la literatura francesa que cuenta la historia de un pequeño príncipe que visita diferentes planetas.",
    category: "Clásico",
    cover_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400",
    epub_url: "https://s3.amazonaws.com/moby-dick/moby-dick.epub",
    price_digital: 0,
    price_physical: 199,
    price_bundle: 229,
    stock_physical: 10,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

export async function getBooks(supabase: SupabaseClient): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase error, using mock data:", error.message);
      return Array.isArray(MOCK_BOOKS) ? MOCK_BOOKS : [];
    }

    return Array.isArray(data) && data.length > 0 ? (data as Book[]) : MOCK_BOOKS;
  } catch (error) {
    console.warn("Using mock books data due to exception");
    return MOCK_BOOKS;
  }
}

export async function getBook(supabase: SupabaseClient, id: string): Promise<Book | null> {
  if (!id) return null;
  const mockBook = MOCK_BOOKS.find(b => b.id === id);

  if (!isValidUUID(id)) {
    return mockBook || null;
  }
  
  try {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error) return mockBook || null;
    return (data as Book) || mockBook || null;
  } catch (error) {
    return mockBook || null;
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
        // Handle Supabase potential nested array or object
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


