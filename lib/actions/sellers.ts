"use server";

import { createClient, createAdminClient } from "@/lib/server";
import { revalidatePath } from "next/cache";

export async function createStockRequestAction(
  sellerId: string,
  items: { book_id: string; quantity: number }[],
  notes?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "vendedor") throw new Error("No autorizado");
  if (sellerId !== user.id) throw new Error("No puedes crear solicitudes para otro vendedor");

  const p_items = items.map(i => ({ book_id: i.book_id, quantity: i.quantity }));

  const { data, error } = await supabase.rpc("create_stock_request", {
    p_seller_id: sellerId,
    p_notes: notes || null,
    p_items: JSON.stringify(p_items),
  });

  if (error) throw new Error(error.message);

  const result = (data as any) || {};
  if (!result.success) throw new Error(result.error || "Error al crear solicitud");

  revalidatePath("/vendedor");
  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
}

export async function receiveStockItemAction(itemId: string, requestId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "vendedor") throw new Error("No autorizado");

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

  // Hacemos la lógica directa con el admin client (bypass RLS) en vez de
  // la RPC, porque auth.uid() puede fallar en Server Actions según el
  // contexto. El server action ya validó que el usuario es admin.
  const adminDb = createAdminClient();

  // Obtener venta
  const { data: sale, error: saleErr } = await adminDb
    .from("seller_sales")
    .select("seller_id, book_id, quantity")
    .eq("id", saleId)
    .single();

  if (saleErr || !sale) throw new Error(saleErr?.message || "Venta no encontrada");

  // Eliminar venta
  const { error: delErr } = await adminDb
    .from("seller_sales")
    .delete()
    .eq("id", saleId);

  if (delErr) throw new Error(delErr.message);

  // Restaurar stock al vendedor
  const { data: existingInv } = await adminDb
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sale.seller_id)
    .eq("book_id", sale.book_id)
    .maybeSingle();

  if (existingInv) {
    await adminDb
      .from("seller_inventory")
      .update({ quantity: existingInv.quantity + sale.quantity, updated_at: new Date().toISOString() })
      .eq("id", existingInv.id);
  } else {
    await adminDb
      .from("seller_inventory")
      .insert({ seller_id: sale.seller_id, book_id: sale.book_id, quantity: sale.quantity });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/vendedores");
}

export async function removeSellerInventoryAction(sellerId: string, bookId: string) {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin") throw new Error("No autorizado");

  const adminDb = createAdminClient();

  // Obtener inventario actual
  const { data: inv, error: invErr } = await adminDb
    .from("seller_inventory")
    .select("id, quantity")
    .eq("seller_id", sellerId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (invErr) throw new Error(invErr.message);
  if (!inv) throw new Error("No hay inventario asignado");

  const removedQty = inv.quantity;

  // Eliminar registro de inventario del vendedor
  const { error: delErr } = await adminDb
    .from("seller_inventory")
    .delete()
    .eq("id", inv.id);

  if (delErr) throw new Error(delErr.message);

  // Devolver stock al almacén general
  const { data: book } = await adminDb
    .from("books")
    .select("stock_physical")
    .eq("id", bookId)
    .single();

  if (book) {
    await adminDb
      .from("books")
      .update({ stock_physical: book.stock_physical + removedQty })
      .eq("id", bookId);
  }

  revalidatePath("/admin");
}
