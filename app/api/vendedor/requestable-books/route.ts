import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/server";

export const dynamic = "force-dynamic";

type RequestableReason = "ok" | "no_admin" | "no_stock";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role, assigned_admin_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userError || !currentUser) {
      return NextResponse.json({ error: "No se pudo validar el usuario" }, { status: 403 });
    }

    if (currentUser.role !== "vendedor" && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const adminId = currentUser.role === "admin" ? user.id : currentUser.assigned_admin_id;

    if (!adminId) {
      return NextResponse.json({ books: [], reason: "no_admin" satisfies RequestableReason });
    }

    const adminDb = createAdminClient();
    const { data: adminStock, error: stockError } = await adminDb
      .from("admin_stock")
      .select("book_id, quantity")
      .eq("admin_id", adminId)
      .gt("quantity", 0);

    if (stockError) {
      console.error("[api/vendedor/requestable-books] Stock error:", stockError);
      return NextResponse.json({ error: "No se pudo consultar el stock" }, { status: 500 });
    }

    const stockRows = adminStock ?? [];
    const bookIds = stockRows.map((item) => item.book_id);

    if (bookIds.length === 0) {
      return NextResponse.json({ books: [], reason: "no_stock" satisfies RequestableReason });
    }

    const stockByBook = new Map(stockRows.map((item) => [item.book_id, item.quantity]));
    const { data: books, error: booksError } = await adminDb
      .from("books")
      .select("id, title, author, cover_url, price_physical, stock_physical")
      .eq("is_active", true)
      .gt("price_physical", 0)
      .in("id", bookIds)
      .order("title", { ascending: true });

    if (booksError) {
      console.error("[api/vendedor/requestable-books] Books error:", booksError);
      return NextResponse.json({ error: "No se pudieron consultar los libros" }, { status: 500 });
    }

    return NextResponse.json({
      books: (books ?? []).map((book) => ({
        ...book,
        stock_physical: stockByBook.get(book.id) ?? 0,
      })),
      reason: "ok" satisfies RequestableReason,
    });
  } catch (error) {
    console.error("[api/vendedor/requestable-books] Error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
