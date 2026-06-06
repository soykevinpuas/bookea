"use server";

import { createClient, createAdminClient } from "@/lib/server";
import { revalidatePath } from "next/cache";

export async function createStockRequestAction(
  sellerId: string,
  items: { book_id: string; quantity: number }[],
  notes?: string
) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role === "admin") throw new Error("Los administradores no pueden crear solicitudes de stock");

  const adminDb = createAdminClient();

  const { data: request, error: reqErr } = await adminDb
    .from("stock_requests")
    .insert({
      seller_id: sellerId,
      notes: notes || null,
      status: "pending",
    })
    .select()
    .single();

  if (reqErr) throw new Error(reqErr.message);

  const requestItems = items.map((item) => ({
    request_id: request.id,
    book_id: item.book_id,
    quantity: item.quantity,
  }));

  const { error: itemsErr } = await adminDb
    .from("stock_request_items")
    .insert(requestItems);

  if (itemsErr) throw new Error(itemsErr.message);

  revalidatePath("/vendedor/solicitudes");
  revalidatePath("/admin");

  return request;
}

export async function receiveStockItemAction(itemId: string, requestId: string) {
  const adminDb = createAdminClient();

  const now = new Date().toISOString();

  const { data: item } = await adminDb
    .from("stock_request_items")
    .select("*, stock_requests!inner(seller_id)")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item no encontrado");
  if ((item as any).received_at) throw new Error("Este libro ya fue recibido");

  const { error: updateErr } = await adminDb
    .from("stock_request_items")
    .update({ received_at: now })
    .eq("id", itemId);

  if (updateErr) throw new Error(updateErr.message);

  const sellerId = (item as any).stock_requests?.seller_id;
  if (!sellerId) throw new Error("No se pudo determinar el vendedor");

  const { data: existing } = await adminDb
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sellerId)
    .eq("book_id", item.book_id)
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await adminDb
      .from("seller_inventory")
      .update({ quantity: existing.quantity + item.quantity, updated_at: now })
      .eq("id", existing.id);
    if (updErr) throw new Error(updErr.message);
  } else {
    const { error: insErr } = await adminDb
      .from("seller_inventory")
      .insert({ seller_id: sellerId, book_id: item.book_id, quantity: item.quantity });
    if (insErr) throw new Error(insErr.message);
  }

  const { data: allItems } = await adminDb
    .from("stock_request_items")
    .select("id, received_at")
    .eq("request_id", requestId);

  const allReceived = (allItems ?? []).every((i: any) => i.received_at !== null);
  if (allReceived) {
    const { error: statusErr } = await adminDb
      .from("stock_requests")
      .update({ status: "delivered", updated_at: now })
      .eq("id", requestId);
    if (statusErr) throw new Error(statusErr.message);
  }

  revalidatePath("/vendedor/solicitudes");
  revalidatePath("/admin");
}

export async function deleteStockRequestAction(requestId: string) {
  const supabase = await createClient();

  const { data: roleData } = await supabase.rpc("get_my_role");
  if (roleData !== "admin") throw new Error("No autorizado");

  const adminDb = createAdminClient();

  const { error: itemsErr } = await adminDb
    .from("stock_request_items")
    .delete()
    .eq("request_id", requestId);

  if (itemsErr) throw new Error(itemsErr.message);

  const { error: reqErr } = await adminDb
    .from("stock_requests")
    .delete()
    .eq("id", requestId);

  if (reqErr) throw new Error(reqErr.message);

  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
}

export async function deleteSaleAction(saleId: string) {
  const supabase = await createClient();

  const { data: roleData } = await supabase.rpc("get_my_role");
  if (roleData !== "admin") throw new Error("No autorizado");

  const adminDb = createAdminClient();

  const { data: sale } = await adminDb
    .from("seller_sales")
    .select("seller_id, book_id, quantity")
    .eq("id", saleId)
    .single();

  if (!sale) throw new Error("Venta no encontrada");

  const { error: delErr } = await adminDb
    .from("seller_sales")
    .delete()
    .eq("id", saleId);

  if (delErr) throw new Error(delErr.message);

  const { data: existing } = await adminDb
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sale.seller_id)
    .eq("book_id", sale.book_id)
    .maybeSingle();

  if (existing) {
    await adminDb
      .from("seller_inventory")
      .update({ quantity: existing.quantity + sale.quantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
}
