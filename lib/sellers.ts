import { SupabaseClient } from "@supabase/supabase-js";
import { SellerInventory, SellerSale, StockRequest, StockRequestItem } from "@/types/seller";

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
  const { data: existing } = await supabase
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sellerId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("seller_inventory")
      .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("seller_inventory")
      .insert({ seller_id: sellerId, book_id: bookId, quantity });
    if (error) throw error;
  }

  const { error: stockErr } = await supabase.rpc("decrement_stock", {
    p_book_id: bookId,
    p_quantity: quantity,
  });
  if (stockErr) throw stockErr;
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

  const { data: inventory } = await supabase
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sellerId)
    .eq("book_id", bookId)
    .single();

  if (!inventory || inventory.quantity < quantity) {
    throw new Error("Stock insuficiente");
  }

  const { error: saleErr } = await supabase.from("seller_sales").insert({
    seller_id: sellerId,
    book_id: bookId,
    quantity,
    sale_price: salePrice,
  });
  if (saleErr) throw saleErr;

  const { error: updateErr } = await supabase
    .from("seller_inventory")
    .update({ quantity: inventory.quantity - quantity, updated_at: new Date().toISOString() })
    .eq("id", inventory.id);
  if (updateErr) throw updateErr;
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
  const { data: request } = await supabase
    .from("stock_requests")
    .select("*, items:stock_request_items(*)")
    .eq("id", requestId)
    .single();

  if (!request) throw new Error("Solicitud no encontrada");

  const items = (request as any).items || [];

  if (status === "shipped") {
    for (const item of items) {
      const { error: rpcErr } = await supabase.rpc("decrement_stock", {
        p_book_id: item.book_id,
        p_quantity: item.quantity,
      });
      if (rpcErr) throw new Error(`Error al descontar stock de ${item.book_id}: ${rpcErr.message}`);
    }
  }

  if (status === "delivered") {
    const now = new Date().toISOString();

    for (const item of items) {
      if ((item as any).received_at) continue;

      const { error: receiveErr } = await supabase
        .from("stock_request_items")
        .update({ received_at: now })
        .eq("id", item.id);
      if (receiveErr) throw receiveErr;

      const { data: existing } = await supabase
        .from("seller_inventory")
        .select("id, quantity")
        .eq("seller_id", request.seller_id)
        .eq("book_id", item.book_id)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from("seller_inventory")
          .update({ quantity: existing.quantity + item.quantity, updated_at: now })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("seller_inventory")
          .insert({ seller_id: request.seller_id, book_id: item.book_id, quantity: item.quantity });
        if (insErr) throw insErr;
      }
    }
  }

  if (status === "cancelled" && request.status === "shipped") {
    for (const item of items) {
      const { error: rpcErr } = await supabase.rpc("increment_stock", {
        p_book_id: item.book_id,
        p_quantity: item.quantity,
      });
      if (rpcErr) throw new Error(`Error al restaurar stock de ${item.book_id}: ${rpcErr.message}`);
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
  const { data } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("role", "vendedor")
    .order("created_at", { ascending: false });

  const sellers = (data ?? []) as { id: string; email: string; role: string; created_at: string }[];

  const enriched = await Promise.all(
    sellers.map(async (seller) => {
      const { count: inventoryCount } = await supabase
        .from("seller_inventory")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", seller.id);

      const { data: inventoryData } = await supabase
        .from("seller_inventory")
        .select("quantity")
        .eq("seller_id", seller.id);

      const totalAssigned = (inventoryData ?? []).reduce((sum, i) => sum + (i.quantity || 0), 0);

      const { data: salesData } = await supabase
        .from("seller_sales")
        .select("quantity")
        .eq("seller_id", seller.id);

      const totalSold = (salesData ?? []).reduce((sum, s) => sum + (s.quantity || 0), 0);

      return {
        ...seller,
        inventory_count: inventoryCount ?? 0,
        total_assigned: totalAssigned,
        total_sold: totalSold,
      };
    })
  );

  return enriched;
}

export async function getAdminSellerDetail(
  supabase: SupabaseClient,
  sellerId: string
) {
  const { data: user } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("id", sellerId)
    .single();

  const inventory = await getSellerInventory(supabase, sellerId);
  const sales = await getSellerSales(supabase, sellerId);

  const { data: requests, error: requestsErr } = await supabase
    .from("stock_requests")
    .select("*, items:stock_request_items(*, books(id, title, author, cover_url, price_physical))")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (requestsErr) {
    console.error("[sellers] getAdminSellerDetail requests error:", requestsErr);
  }

  return {
    seller: user,
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
  const { data: item } = await supabase
    .from("seller_inventory")
    .select("id, quantity, book_id, seller_id")
    .eq("id", inventoryId)
    .single();

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
  const { data: existing } = await supabase
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sellerId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    const newQty = existing.quantity - quantity;
    if (newQty <= 0) {
      await supabase.from("seller_inventory").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("seller_inventory")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
  }

  const { error: stockErr } = await supabase.rpc("increment_stock", {
    p_book_id: bookId,
    p_quantity: quantity,
  });
  if (stockErr) throw stockErr;
}
