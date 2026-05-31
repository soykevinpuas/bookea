"use server";

import { createAdminClient } from "@/lib/server";
import { revalidatePath } from "next/cache";

export async function createStockRequestAction(
  sellerId: string,
  items: { book_id: string; quantity: number }[],
  notes?: string
) {
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
  revalidatePath("/admin/stock-requests");

  return request;
}
