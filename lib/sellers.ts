import { SupabaseClient } from "@supabase/supabase-js";
import { SellerInventory, SellerSale, StockRequest } from "@/types/seller";

// ─── Inventory ──────────────────────────────────────────────

export async function getSellerInventory(
  supabase: SupabaseClient,
  sellerId: string
): Promise<SellerInventory[]> {
  const { data, error } = await supabase
    .from("seller_inventory")
    .select("*, books(id, title, author, cover_url, price_physical)")
    .eq("seller_id", sellerId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[sellers] getSellerInventory error:", error);
    return [];
  }

  return (data ?? []) as unknown as SellerInventory[];
}

export async function assignStock(
  supabase: SupabaseClient,
  sellerId: string,
  bookId: string,
  quantity: number
) {
  const { data, error } = await supabase.rpc("assign_stock", {
    p_seller_id: sellerId,
    p_book_id: bookId,
    p_quantity: quantity,
  });

  if (error) throw error;
  const result = (data as any) || {};
  if (!result.success) throw new Error(result.error || "Error al asignar stock");
}

export const COST_PER_BOOK = 200;

// ─── Sales ──────────────────────────────────────────────────

export async function markAsSold(
  supabase: SupabaseClient,
  sellerId: string,
  bookId: string,
  quantity: number = 1,
  salePrice: number = COST_PER_BOOK
) {
  if (salePrice <= 0) throw new Error("El precio de venta debe ser mayor a 0");
  if (!sellerId) throw new Error("Vendedor no autenticado");

  const { data, error: rpcErr } = await supabase.rpc("sell_book", {
    p_seller_id: sellerId,
    p_book_id: bookId,
    p_quantity: quantity,
    p_sale_price: salePrice,
  });

  if (rpcErr) throw new Error(`Error al registrar venta: ${rpcErr.message}`);

  const result = (data as any) || {};
  if (!result.success) throw new Error(result.error || "Error al registrar venta");
}

export async function getSellerSales(
  supabase: SupabaseClient,
  sellerId: string
): Promise<SellerSale[]> {
  const { data, error } = await supabase
    .from("seller_sales")
    .select("*, books(id, title, author, cover_url, price_physical)")
    .eq("seller_id", sellerId)
    .order("sold_at", { ascending: false });

  if (error) {
    console.error("[sellers] getSellerSales error:", error);
    return [];
  }

  return (data ?? []) as unknown as SellerSale[];
}

// ─── Stock Requests ─────────────────────────────────────────

export async function createStockRequest(
  supabase: SupabaseClient,
  sellerId: string,
  items: { book_id: string; quantity: number }[],
  notes?: string
) {
  const { data: request, error: reqErr } = await supabase
    .from("stock_requests")
    .insert({
      seller_id: sellerId,
      notes: notes || null,
      status: "pending",
    })
    .select()
    .single();

  if (reqErr) throw reqErr;

  const requestItems = items.map((item) => ({
    request_id: request.id,
    book_id: item.book_id,
    quantity: item.quantity,
  }));

  const { error: itemsErr } = await supabase
    .from("stock_request_items")
    .insert(requestItems);

  if (itemsErr) throw itemsErr;

  return request as StockRequest;
}

export async function getSellerRequests(
  supabase: SupabaseClient,
  sellerId: string
): Promise<StockRequest[]> {
  const { data, error } = await supabase
    .from("stock_requests")
    .select("*, items:stock_request_items(*, books(id, title, author, cover_url, price_physical))")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[sellers] getSellerRequests error:", error);
    return [];
  }

  return (data ?? []) as unknown as StockRequest[];
}

// ─── Admin: Stock Requests ──────────────────────────────────

export async function getAllStockRequests(
  supabase: SupabaseClient
): Promise<StockRequest[]> {
  const { data, error } = await supabase
    .from("stock_requests")
    .select("*, items:stock_request_items(*, books(id, title, author, cover_url, price_physical)), seller:seller_id(id, email)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[sellers] getAllStockRequests error:", error);
    return [];
  }

  return (data ?? []) as unknown as StockRequest[];
}

export async function updateStockRequestStatus(
  supabase: SupabaseClient,
  requestId: string,
  status: StockRequest["status"],
  trackingNumber?: string
) {
  if (status === "delivered") {
    const { data, error: rpcErr } = await supabase.rpc("deliver_stock_request", {
      p_request_id: requestId,
      p_tracking_number: trackingNumber || null,
    });
    if (rpcErr) {
      console.error("[updateStockRequestStatus] rpc error:", rpcErr);
      throw new Error(`Error al entregar solicitud: ${rpcErr.message}`);
    }
    const raw = (data as any) || {};
    const result = raw.success !== undefined ? raw : (Array.isArray(raw) ? raw[0] : raw);
    if (!result?.success) throw new Error(result?.error || "Error al entregar solicitud");
    return;
  }

  if (status === "cancelled") {
    const { data: request, error: reqErr } = await supabase
      .from("stock_requests")
      .select("status")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr) throw reqErr;

    if (request?.status === "delivered") {
      const { data, error: rpcErr } = await supabase.rpc("cancel_stock_request", {
        p_request_id: requestId,
      });
      if (rpcErr) {
        console.error("[updateStockRequestStatus] cancel rpc error:", rpcErr);
        throw new Error(`Error al cancelar solicitud: ${rpcErr.message}`);
      }
      const raw = (data as any) || {};
      const result = raw.success !== undefined ? raw : (Array.isArray(raw) ? raw[0] : raw);
      if (!result?.success) throw new Error(result?.error || "Error al cancelar solicitud");
      return;
    }
  }

  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (trackingNumber !== undefined) {
    update.tracking_number = trackingNumber;
  }

  const { error } = await supabase
    .from("stock_requests")
    .update(update)
    .eq("id", requestId);
  if (error) throw error;
}

// ─── Admin: Seller Management ───────────────────────────────

export async function getAdminSellers(supabase: SupabaseClient) {
  const { data: usersData, error: usersErr } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("role", "vendedor")
    .order("created_at", { ascending: false });
  if (usersErr) throw usersErr;

  const sellers = (usersData ?? []) as { id: string; email: string; role: string; created_at: string }[];
  if (sellers.length === 0) return [];

  const sellerIds = sellers.map((s) => s.id);

  const [{ data: inventoryData }, { data: salesData }] = await Promise.all([
    supabase
      .from("seller_inventory")
      .select("seller_id, quantity")
      .in("seller_id", sellerIds),
    supabase
      .from("seller_sales")
      .select("seller_id, quantity")
      .in("seller_id", sellerIds),
  ]);

  const invCounts = new Map<string, number>();
  const invQtys = new Map<string, number>();
  for (const inv of inventoryData ?? []) {
    invCounts.set(inv.seller_id, (invCounts.get(inv.seller_id) || 0) + 1);
    invQtys.set(inv.seller_id, (invQtys.get(inv.seller_id) || 0) + (inv.quantity || 0));
  }

  const salesQtys = new Map<string, number>();
  for (const sale of salesData ?? []) {
    salesQtys.set(sale.seller_id, (salesQtys.get(sale.seller_id) || 0) + (sale.quantity || 0));
  }

  return sellers.map((seller) => ({
    ...seller,
    inventory_count: invCounts.get(seller.id) ?? 0,
    total_assigned: invQtys.get(seller.id) ?? 0,
    total_sold: salesQtys.get(seller.id) ?? 0,
  }));
}

export async function getAdminSellerDetail(
  supabase: SupabaseClient,
  sellerId: string
) {
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("id", sellerId)
    .maybeSingle();
  if (userErr) throw new Error(`Error al obtener vendedor: ${userErr.message}`);

  const inventory = await getSellerInventory(supabase, sellerId);
  const sales = await getSellerSales(supabase, sellerId);

  const { data: requests, error: requestsErr } = await supabase
    .from("stock_requests")
    .select("*, items:stock_request_items(*, books(id, title, author, cover_url, price_physical))")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (requestsErr) throw new Error(`Error al obtener solicitudes: ${requestsErr.message}`);

  return {
    seller: user ?? null,
    inventory,
    sales,
    requests: (requests ?? []) as unknown as StockRequest[],
  };
}

export async function getPhysicalBooks(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("books")
    .select("id, title, author, cover_url, price_physical, stock_physical")
    .eq("is_active", true)
    .gt("price_physical", 0)
    .gt("stock_physical", 0)
    .order("title", { ascending: true });

  return data ?? [];
}

// ─── Payment Tracking ────────────────────────────────────────

export async function getPendingPayments(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("seller_sales")
    .select("*, books(id, title, author, cover_url, price_physical), seller:seller_id(id, email), profile:seller_id(name)")
    .is("paid_at", null)
    .order("sold_at", { ascending: false });

  return (data ?? []) as unknown as (SellerSale & { seller: { id: string; email: string }; profile: { name: string } })[];
}

export async function getSellerPendingTotal(supabase: SupabaseClient, sellerId: string) {
  const { data } = await supabase
    .from("seller_sales")
    .select("quantity")
    .eq("seller_id", sellerId)
    .is("paid_at", null);

  return (data ?? []).reduce((sum, s) => sum + s.quantity * COST_PER_BOOK, 0);
}

export async function markSalesAsPaid(supabase: SupabaseClient, saleIds: string[]) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("seller_sales")
    .update({ paid_at: now })
    .in("id", saleIds);

  if (error) throw error;
}

export async function revertMarkAsPaid(supabase: SupabaseClient, saleId: string) {
  const { error } = await supabase
    .from("seller_sales")
    .update({ paid_at: null })
    .eq("id", saleId);

  if (error) throw error;
}

export async function adjustInventory(
  supabase: SupabaseClient,
  inventoryId: string,
  delta: number
) {
  const { data: item, error: itemErr } = await supabase
    .from("seller_inventory")
    .select("id, quantity, book_id, seller_id")
    .eq("id", inventoryId)
    .single();

  if (itemErr) throw new Error(`Error al obtener item: ${itemErr.message}`);
  if (!item) throw new Error("Item no encontrado");

  const newQty = item.quantity + delta;
  if (newQty < 0) throw new Error("Stock no puede ser negativo");

  if (delta > 0) {
    const { error: rpcErr } = await supabase.rpc("decrement_stock", {
      p_book_id: item.book_id,
      p_quantity: Math.abs(delta),
    });
    if (rpcErr) throw rpcErr;
  } else if (delta < 0) {
    const { error: rpcErr } = await supabase.rpc("increment_stock", {
      p_book_id: item.book_id,
      p_quantity: Math.abs(delta),
    });
    if (rpcErr) throw rpcErr;
  }

  if (newQty <= 0) {
    const { error } = await supabase.from("seller_inventory").delete().eq("id", inventoryId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("seller_inventory")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", inventoryId);
    if (error) throw error;
  }
}

export async function revertAssignStock(
  supabase: SupabaseClient,
  sellerId: string,
  bookId: string,
  quantity: number
) {
  const { data, error } = await supabase.rpc("revert_assign_stock", {
    p_seller_id: sellerId,
    p_book_id: bookId,
    p_quantity: quantity,
  });

  if (error) throw error;
  const result = (data as any) || {};
  if (!result.success) throw new Error(result.error || "Error al revertir asignación");
}
