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

  for (const item of items) {
    const { data: book, error: bookCheckErr } = await adminDb
      .from("books")
      .select("stock_physical, title")
      .eq("id", item.book_id)
      .single();
    if (bookCheckErr) throw new Error(`Error al verificar stock de "${item.book_id}": ${bookCheckErr.message}`);
    if (!book || book.stock_physical < item.quantity) {
      throw new Error(`Stock insuficiente para "${book?.title || item.book_id}". Disponible: ${book?.stock_physical ?? 0}, solicitado: ${item.quantity}`);
    }
  }

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

  revalidatePath("/vendedor");
  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
}

export async function receiveStockItemAction(itemId: string, requestId: string) {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "vendedor") throw new Error("No autorizado");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const adminDb = createAdminClient();

  const { data: item, error: itemErr } = await adminDb
    .from("stock_request_items")
    .select("*, stock_requests!inner(seller_id, status)")
    .eq("id", itemId)
    .single();

  if (itemErr) throw new Error(`Error al obtener item: ${itemErr.message}`);
  if (!item) throw new Error("Item no encontrado");

  const req = (item as any).stock_requests;
  if (req.seller_id !== user.id) throw new Error("Esta solicitud no te pertenece");
  if (req.status !== "delivered") throw new Error("La solicitud debe estar entregada para recibir libros");
  if ((item as any).received_at) throw new Error("Este libro ya fue recibido");

  const { error: updateErr } = await adminDb
    .from("stock_request_items")
    .update({ received_at: new Date().toISOString() })
    .eq("id", itemId)
    .is("received_at", null);

  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/vendedor");
  revalidatePath("/admin");
}

export async function deleteStockRequestAction(requestId: string) {
  const supabase = await createClient();

  const { data: roleData } = await supabase.rpc("get_my_role");
  if (roleData !== "admin") throw new Error("No autorizado");

  const adminDb = createAdminClient();

  const { data: request, error: reqCheck } = await adminDb
    .from("stock_requests")
    .select("status")
    .eq("id", requestId)
    .single();

  if (reqCheck) throw new Error("Solicitud no encontrada");
  if (request.status === "delivered" || request.status === "cancelled") {
    throw new Error("No se puede eliminar una solicitud entregada o cancelada");
  }

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

  const { data: sale, error: saleErr } = await adminDb
    .from("seller_sales")
    .select("seller_id, book_id, quantity")
    .eq("id", saleId)
    .single();

  if (saleErr) throw new Error(`Error al obtener venta: ${saleErr.message}`);
  if (!sale) throw new Error("Venta no encontrada");

  const { error: delErr } = await adminDb
    .from("seller_sales")
    .delete()
    .eq("id", saleId);

  if (delErr) throw new Error(delErr.message);

  const { data: existing, error: invErr } = await adminDb
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sale.seller_id)
    .eq("book_id", sale.book_id)
    .maybeSingle();
  if (invErr) throw invErr;

  const now = new Date().toISOString();
  if (existing) {
    const { error: updErr } = await adminDb
      .from("seller_inventory")
      .update({ quantity: existing.quantity + sale.quantity, updated_at: now })
      .eq("id", existing.id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await adminDb
      .from("seller_inventory")
      .insert({ seller_id: sale.seller_id, book_id: sale.book_id, quantity: sale.quantity });
    if (insErr) throw insErr;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
}
