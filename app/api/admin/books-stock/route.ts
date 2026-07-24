import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/server";
import type { StockMutationResult } from "@/types/stock";

export const dynamic = "force-dynamic";

type StockRow = {
  book_id: string;
  quantity: number;
};

type AdminBookRow = {
  id: string;
  stock_physical?: number | null;
  [key: string]: unknown;
};

type StockPatchBody = {
  bookId?: string;
  delta?: number | string;
  totalStock?: number | string;
  acquisitionCost?: number | string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error del servidor";
}

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

    const [booksResult, adminStockResult, sellerStockResult, costsResult] = await Promise.all([
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
      adminDb
        .from("admin_book_costs")
        .select("book_id, acquisition_cost")
        .eq("admin_id", adminId),
    ]);

    if (booksResult.error) throw booksResult.error;
    if (adminStockResult.error) throw adminStockResult.error;
    if (sellerStockResult.error) throw sellerStockResult.error;
    if (costsResult.error) throw costsResult.error;

    const warehouseByBook = sumStock(adminStockResult.data as StockRow[]);
    const assignedByBook = sumStock(sellerStockResult.data as StockRow[]);
    const costByBook = new Map(
      (costsResult.data ?? []).map((row) => [row.book_id as string, Number(row.acquisition_cost)])
    );

    const books = ((booksResult.data ?? []) as AdminBookRow[]).map((book) => {
      const stockWarehouse = warehouseByBook.get(book.id) ?? 0;
      const stockAssigned = assignedByBook.get(book.id) ?? 0;
      const stockTotal = stockWarehouse + stockAssigned;

      return {
        ...book,
        stock_physical: stockTotal,
        stock_total: stockTotal,
        stock_warehouse: stockWarehouse,
        stock_assigned: stockAssigned,
        acquisition_cost: costByBook.get(book.id) ?? 100,
      };
    });

    return NextResponse.json({ books });
  } catch (error: unknown) {
    console.error("[api/admin/books-stock] GET error:", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAdminContext();
    if (context.error) return context.error;

    const { adminId } = context;
    const body = await request.json() as StockPatchBody;
    const bookId = String(body.bookId || "");
    const hasDelta = body.delta !== undefined && body.delta !== null;
    const hasTotalStock = body.totalStock !== undefined && body.totalStock !== null;
    const hasAcquisitionCost = body.acquisitionCost !== undefined && body.acquisitionCost !== null;

    if (!bookId) {
      return NextResponse.json({ error: "Falta bookId" }, { status: 400 });
    }
    if (!hasDelta && !hasTotalStock && !hasAcquisitionCost) {
      return NextResponse.json({ error: "Falta un cambio de stock o costo" }, { status: 400 });
    }

    const rawDelta = hasDelta ? Number(body.delta) : null;
    const rawTotalStock = hasTotalStock ? Number(body.totalStock) : null;
    const rawAcquisitionCost = hasAcquisitionCost ? Number(body.acquisitionCost) : null;
    if ((hasDelta && !Number.isFinite(rawDelta)) || (hasTotalStock && !Number.isFinite(rawTotalStock))) {
      return NextResponse.json({ error: "Cantidad de stock inválida" }, { status: 400 });
    }
    if (hasAcquisitionCost && (!Number.isFinite(rawAcquisitionCost) || (rawAcquisitionCost ?? -1) < 0)) {
      return NextResponse.json({ error: "Costo de adquisición inválido" }, { status: 400 });
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

    if (rawAcquisitionCost !== null) {
      const { error: costError } = await adminDb.from("admin_book_costs").upsert({
        admin_id: adminId,
        book_id: bookId,
        acquisition_cost: rawAcquisitionCost,
        updated_at: new Date().toISOString(),
      });
      if (costError) throw costError;
    }

    if (!hasDelta && !hasTotalStock) {
      return NextResponse.json({ success: true });
    }

    const assignedStock = ((assignedResult.data ?? []) as Pick<StockRow, "quantity">[])
      .reduce((sum, row) => sum + (row.quantity || 0), 0);
    const warehouseStock = warehouseResult.data?.quantity ?? 0;
    const requestedDelta = rawDelta !== null ? Math.trunc(rawDelta) : null;
    const totalStock = rawTotalStock !== null ? Math.max(0, Math.floor(rawTotalStock)) : null;
    const desiredWarehouseStock = requestedDelta !== null
      ? warehouseStock + requestedDelta
      : (totalStock ?? 0) - assignedStock;

    if (desiredWarehouseStock < 0) {
      return NextResponse.json(
        {
          error: requestedDelta !== null
            ? "No puedes dejar tu stock en almacén por debajo de cero."
            : `No puedes bajar el total a ${totalStock}; ya hay ${assignedStock} unidades asignadas a vendedores.`,
        },
        { status: 400 }
      );
    }

    const delta = desiredWarehouseStock - warehouseStock;
    const { data, error } = await context.supabase!.rpc("adjust_admin_stock", {
      p_book_id: bookId,
      p_delta: delta,
    });

    if (error) throw error;
    const stockMutationResult = ((data as StockMutationResult | null) || {}) as StockMutationResult;
    if (!stockMutationResult.success) {
      return NextResponse.json({ error: stockMutationResult.error || "No se pudo ajustar el stock" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      stock_total: desiredWarehouseStock + assignedStock,
      stock_warehouse: desiredWarehouseStock,
      stock_assigned: assignedStock,
      mutation_id: stockMutationResult.mutation_id,
      snapshots: stockMutationResult.snapshots ?? [],
      events: stockMutationResult.events ?? [],
    });
  } catch (error: unknown) {
    console.error("[api/admin/books-stock] PATCH error:", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
