import { supabase } from "@/lib/supabase";
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
  {
    id: "2",
    title: "Cien Años de Soledad",
    author: "Gabriel García Márquez",
    description: "La saga de la familia Buendía a través de siete generaciones en el pueblo ficticio de Macondo.",
    category: "Novela",
    cover_url: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400",
    epub_url: "https://example.com/cien-anos.epub",
    price_digital: 49,
    price_physical: 249,
    price_bundle: null,
    stock_physical: 5,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Harry Potter y la Piedra Filosofal",
    author: "J.K. Rowling",
    description: "El primer libro de la saga de Harry Potter, donde un joven mago descubre su verdadera identidad.",
    category: "Fantasía",
    cover_url: "https://images.unsplash.com/photo-1618666012174-83b441c0bc76?w=400",
    epub_url: "https://example.com/harry-potter.epub",
    price_digital: 49,
    price_physical: 199,
    price_bundle: 229,
    stock_physical: 8,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// UUID v4 format check — prevents sending non-UUID IDs to Supabase (which expects UUID columns)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_REGEX.test(id);

export async function getBooks(): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase error, using mock data:", error.message);
      return MOCK_BOOKS;
    }

    // If DB is empty (no books uploaded yet), fall back to mock data
    return data && data.length > 0 ? data : MOCK_BOOKS;
  } catch (error) {
    console.warn("Using mock books data");
    return MOCK_BOOKS;
  }
}

export async function getBook(id: string): Promise<Book | null> {
  // Check mock array first — fast path for development IDs ("1", "2", "3")
  const mockBook = MOCK_BOOKS.find(b => b.id === id);

  // If this is NOT a valid UUID, Supabase will 400. Serve mock directly.
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
    return data;
  } catch (error) {
    return mockBook || null;
  }
}

export async function getUserBooks(userId: string): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .from("user_books")
      .select("books(*)")
      .eq("user_id", userId);

    if (error) {
      console.warn("Supabase error fetching user_books, using mock data:", error.message);
      return [MOCK_BOOKS[0]]; // Fallback for testing
    }

    // Supabase nested select returns an array of objects like { books: {id, title...} }
    // We map it to return just the books array
    const books = data
      ?.map((item) => item.books as unknown as Book)
      .filter(Boolean) || [];

    return books.length > 0 ? books : [MOCK_BOOKS[0]]; // Return mock if empty just for testing MVP
  } catch (error) {
    console.warn("Using mock user books data");
    return [MOCK_BOOKS[0]];
  }
}

export async function hasBookAccess(userId: string, bookId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  } catch (error) {
    return false;
  }
}
