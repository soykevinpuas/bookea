import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/server";

export const dynamic = "force-dynamic";

type StockRow = {
  book_id: string;
  quantity: number;
};

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const { data: roleData } = await supabase.rpc("get_my_role");
  if (roleData !== "admin") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  return { supabase, adminId: user.id };
}

async function getSellerIds(adminDb: ReturnType<typeof createAdminClient>, adminId: string) {
  const { data: sellers, error } = await adminDb
    .from("users")
    .select("id")
    .eq("role", "vendedor")
    .or(`assigned_admin_id.eq.${adminId},assigned_admin_id.is.null`);

  if (error) throw error;
  return [adminId, ...(sellers ?? []).map((seller) => seller.id as string)];
}

function sumStock(rows: StockRow[] | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    map.set(row.book_id, (map.get(row.book_id) ?? 0) + (row.quantity || 0));
  }
  return map;
}

export async function GET() {
  try {
    const context = await getAdminContext();
    if (context.error) return context.error;

    const { adminId } = context;
    const adminDb = createAdminClient();
    const sellerIds = await getSellerIds(adminDb, adminId);

    const [booksResult, adminStockResult, sellerStockResult] = await Promise.all([
      adminDb
        .from("books")
        .select("*")
        .order("created_at", { ascending: false }),
      adminDb
        .from("admin_stock")
        .select("book_id, quantity")
        .eq("admin_id", adminId),
      sellerIds.length > 0
        ? adminDb
            .from("seller_inventory")
            .select("book_id, quantity")
            .in("seller_id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (booksResult.error) throw booksResult.error;
    if (adminStockResult.error) throw adminStockResult.error;
    if (sellerStockResult.error) throw sellerStockResult.error;

    const warehouseByBook = sumStock(adminStockResult.data as StockRow[]);
    const assignedByBook = sumStock(sellerStockResult.data as StockRow[]);

    const books = (booksResult.data ?? []).map((book: UntypedValue) => {
      const stockWarehouse = warehouseByBook.get(book.id) ?? 0;
      const stockAssigned = assignedByBook.get(book.id) ?? 0;
      const stockTotal = stockWarehouse + stockAssigned;

      return {
        ...book,
        stock_physical: stockTotal,
        stock_total: stockTotal,
        stock_warehouse: stockWarehouse,
        stock_assigned: stockAssigned,
      };
    });

    return NextResponse.json({ books });
  } catch (error: UntypedValue) {
    console.error("[api/admin/books-stock] GET error:", error);
    return NextResponse.json({ error: error.message || "Error del servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAdminContext();
    if (context.error) return context.error;

    const { adminId } = context;
    const body = await request.json();
    const bookId = String(body.bookId || "");
    const totalStock = Math.max(0, Math.floor(Number(body.totalStock) || 0));

    if (!bookId) {
      return NextResponse.json({ error: "Falta bookId" }, { status: 400 });
    }

    const adminDb = createAdminClient();
    const sellerIds = await getSellerIds(adminDb, adminId);

    const [bookResult, warehouseResult, assignedResult] = await Promise.all([
      adminDb
        .from("books")
        .select("id")
        .eq("id", bookId)
        .maybeSingle(),
      adminDb
        .from("admin_stock")
        .select("quantity")
        .eq("admin_id", adminId)
        .eq("book_id", bookId)
        .maybeSingle(),
      sellerIds.length > 0
        ? adminDb
            .from("seller_inventory")
            .select("quantity")
            .eq("book_id", bookId)
            .in("seller_id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (bookResult.error) throw bookResult.error;
    if (!bookResult.data) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }
    if (warehouseResult.error) throw warehouseResult.error;
    if (assignedResult.error) throw assignedResult.error;

    const assignedStock = (assignedResult.data ?? []).reduce(
      (sum: number, row: UntypedValue) => sum + (row.quantity || 0),
      0
    );
    const warehouseStock = warehouseResult.data?.quantity ?? 0;
    const desiredWarehouseStock = totalStock - assignedStock;

    if (desiredWarehouseStock < 0) {
      return NextResponse.json(
        {
          error: `No puedes bajar el total a ${totalStock}; ya hay ${assignedStock} unidades asignadas a vendedores.`,
        },
        { status: 400 }
      );
    }

    const delta = desiredWarehouseStock - warehouseStock;
    if (delta !== 0) {
      const { data, error } = await context.supabase!.rpc("adjust_admin_stock", {
        p_book_id: bookId,
        p_delta: delta,
      });

      if (error) throw error;
      const result = (data as UntypedValue) || {};
      if (!result.success) {
        return NextResponse.json({ error: result.error || "No se pudo ajustar el stock" }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      stock_total: totalStock,
      stock_warehouse: desiredWarehouseStock,
      stock_assigned: assignedStock,
    });
  } catch (error: UntypedValue) {
    console.error("[api/admin/books-stock] PATCH error:", error);
    return NextResponse.json({ error: error.message || "Error del servidor" }, { status: 500 });
  }
}
