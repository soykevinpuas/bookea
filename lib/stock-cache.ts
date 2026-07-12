import type { QueryClient } from "@tanstack/react-query";
import type { SellerInventory, SellerSale } from "@/types/seller";
import type { StockMutationResult, StockSnapshot } from "@/types/stock";

type StockCacheOptions = {
  sellerId?: string | null;
  adminId?: string | null;
};

function snapshotTime(snapshot: StockSnapshot) {
  const parsed = Date.parse(snapshot.version || snapshot.updated_at || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowTime(row: UntypedValue) {
  const raw = row?.stock_version || row?.updated_at;
  const parsed = Date.parse(raw || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldApplySnapshot(row: UntypedValue, snapshot: StockSnapshot) {
  const current = rowTime(row);
  const next = snapshotTime(snapshot);
  return current === 0 || next === 0 || next >= current;
}

function inventoryBook(snapshot: StockSnapshot, previous?: UntypedValue) {
  if (previous?.books) return previous.books;
  if (!snapshot.book) return null;

  return {
    id: snapshot.book.id,
    title: snapshot.book.title,
    author: snapshot.book.author ?? "",
    cover_url: snapshot.book.cover_url,
    price_physical: snapshot.book.price_physical ?? 0,
  };
}

function updateSellerInventoryList(
  inventory: SellerInventory[] | undefined,
  snapshots: StockSnapshot[],
  sellerId?: string | null
) {
  let next = [...(inventory ?? [])] as UntypedValue[];

  for (const snapshot of snapshots) {
    if (!snapshot.seller_id) continue;
    if (sellerId && snapshot.seller_id !== sellerId) continue;

    const index = next.findIndex(
      (item) => item.book_id === snapshot.book_id && item.seller_id === snapshot.seller_id
    );
    const existing = index >= 0 ? next[index] : null;

    if (existing && !shouldApplySnapshot(existing, snapshot)) continue;

    if (snapshot.seller_quantity <= 0) {
      next = next.filter(
        (item) => !(item.book_id === snapshot.book_id && item.seller_id === snapshot.seller_id)
      );
      continue;
    }

    const updated = {
      ...(existing ?? {
        id: `snapshot-${snapshot.seller_id}-${snapshot.book_id}`,
        seller_id: snapshot.seller_id,
        book_id: snapshot.book_id,
      }),
      quantity: snapshot.seller_quantity,
      updated_at: snapshot.updated_at,
      stock_version: snapshot.version,
      books: inventoryBook(snapshot, existing),
      seller: existing?.seller ?? (
        snapshot.seller_email ? { id: snapshot.seller_id, email: snapshot.seller_email } : undefined
      ),
    };

    if (index >= 0) next[index] = updated;
    else next.unshift(updated);
  }

  return next as SellerInventory[];
}

function updateAdminStockRows(rows: UntypedValue[] | undefined, snapshots: StockSnapshot[]) {
  const next = [...(rows ?? [])];

  for (const snapshot of snapshots) {
    if (!snapshot.admin_id) continue;
    const index = next.findIndex((row) => row.book_id === snapshot.book_id);
    const updated = {
      ...(index >= 0 ? next[index] : { book_id: snapshot.book_id }),
      quantity: snapshot.warehouse_quantity,
      updated_at: snapshot.updated_at,
      stock_version: snapshot.version,
    };

    if (index >= 0) {
      if (shouldApplySnapshot(next[index], snapshot)) next[index] = updated;
    } else {
      next.push(updated);
    }
  }

  return next;
}

function updateBookStockRows(rows: UntypedValue[] | undefined, snapshots: StockSnapshot[], mode: "total" | "warehouse") {
  let next = [...(rows ?? [])];

  for (const snapshot of snapshots) {
    const index = next.findIndex((book) => book.id === snapshot.book_id);
    const quantity = mode === "warehouse" ? snapshot.warehouse_quantity : snapshot.total_physical;

    if (quantity <= 0 && mode === "warehouse") {
      next = next.filter((book) => book.id !== snapshot.book_id);
      continue;
    }

    const existing = index >= 0 ? next[index] : null;
    const baseBook = existing ?? snapshot.book;
    if (!baseBook) continue;
    if (existing && !shouldApplySnapshot(existing, snapshot)) continue;

    const updated = {
      ...baseBook,
      stock_physical: quantity,
      stock_total: snapshot.total_physical,
      stock_warehouse: snapshot.warehouse_quantity,
      stock_assigned: snapshot.assigned_quantity,
      updated_at: snapshot.updated_at,
      stock_version: snapshot.version,
    };

    if (index >= 0) next[index] = updated;
    else next.unshift(updated);
  }

  return next;
}

function updateVendedorDashboard(old: UntypedValue, snapshots: StockSnapshot[], result?: StockMutationResult, sellerId?: string | null) {
  if (!old) return old;

  const nextInventory = updateSellerInventoryList(old.inventory, snapshots, sellerId);
  let nextSales = old.sales ?? [];
  let pendingPayment = old.pendingPayment ?? 0;
  const sale = result?.sale as SellerSale | undefined;

  if (sale && (!sellerId || sale.seller_id === sellerId)) {
    const exists = nextSales.some((item: SellerSale) => item.id === sale.id);
    if (!exists) {
      nextSales = [sale, ...nextSales];
      if (old.role !== "admin") pendingPayment += sale.sale_price * sale.quantity;
    }
  }

  return {
    ...old,
    inventory: nextInventory,
    sales: nextSales,
    pendingPayment,
  };
}

function updateAdminDashboard(old: UntypedValue, snapshots: StockSnapshot[]) {
  if (!old) return old;

  const previousInventory = old.inventory?.data ?? [];
  const nextInventory = updateSellerInventoryList(previousInventory, snapshots);
  const totalDelta = nextInventory.length - previousInventory.length;

  return {
    ...old,
    adminStock: updateAdminStockRows(old.adminStock, snapshots),
    physicalBooks: updateBookStockRows(old.physicalBooks, snapshots, "total"),
    inventory: old.inventory
      ? {
          ...old.inventory,
          data: nextInventory,
          total: Math.max(0, (old.inventory.total ?? nextInventory.length) + totalDelta),
        }
      : old.inventory,
  };
}

function updateAdminSellerDetail(old: UntypedValue, snapshots: StockSnapshot[], sellerId: string | null) {
  if (!old || !sellerId) return old;
  return {
    ...old,
    inventory: updateSellerInventoryList(old.inventory, snapshots, sellerId),
  };
}

function updateAdminSellers(old: UntypedValue, snapshots: StockSnapshot[]) {
  if (!Array.isArray(old)) return old;

  return old.map((seller) => {
    const snapshot = snapshots.find((item) => item.seller_id === seller.id);
    if (!snapshot) return seller;

    return {
      ...seller,
      inventory_count: snapshot.seller_inventory_count,
      total_assigned: snapshot.seller_total_quantity,
    };
  });
}

function updateAdminBooksResponse(old: UntypedValue, snapshots: StockSnapshot[]) {
  if (!old?.books) return old;
  return {
    ...old,
    books: updateBookStockRows(old.books, snapshots, "total"),
  };
}

function updateRequestableBooksResponse(old: UntypedValue, snapshots: StockSnapshot[]) {
  if (!old?.books) return old;
  return {
    ...old,
    books: updateBookStockRows(old.books, snapshots, "warehouse"),
  };
}

// Extrae snapshots tanto de respuestas RPC como de eventos Realtime.
export function getStockSnapshots(result: StockMutationResult | null | undefined): StockSnapshot[] {
  if (!result) return [];

  const direct = Array.isArray(result.snapshots) ? result.snapshots : [];
  const fromEvents = Array.isArray(result.events)
    ? result.events.map((event) => event.snapshot_after).filter(Boolean) as StockSnapshot[]
    : [];

  const byKey = new Map<string, StockSnapshot>();
  for (const snapshot of [...direct, ...fromEvents]) {
    byKey.set(`${snapshot.seller_id ?? "admin"}:${snapshot.book_id}`, snapshot);
  }

  return Array.from(byKey.values());
}

// Aplica snapshots confirmados por servidor en todas las caches conocidas.
export function applyStockMutationResult(
  queryClient: QueryClient,
  result: StockMutationResult | null | undefined,
  options: StockCacheOptions = {}
) {
  const snapshots = getStockSnapshots(result);
  if (snapshots.length === 0) return;

  if (options.sellerId) {
    queryClient.setQueryData(["vendedor-dashboard", options.sellerId], (old: UntypedValue) =>
      updateVendedorDashboard(old, snapshots, result ?? undefined, options.sellerId)
    );
  }

  queryClient.setQueriesData({ queryKey: ["admin-dashboard"] }, (old: UntypedValue) =>
    updateAdminDashboard(old, snapshots)
  );

  queryClient.setQueriesData({ queryKey: ["admin-books"] }, (old: UntypedValue) =>
    updateAdminBooksResponse(old, snapshots)
  );

  queryClient.setQueriesData({ queryKey: ["physical-books"] }, (old: UntypedValue) =>
    updateBookStockRows(old, snapshots, "warehouse")
  );

  queryClient.setQueriesData({ queryKey: ["requestable-books"] }, (old: UntypedValue) =>
    updateRequestableBooksResponse(old, snapshots)
  );

  queryClient.setQueriesData({ queryKey: ["admin-sellers"] }, (old: UntypedValue) =>
    updateAdminSellers(old, snapshots)
  );

  for (const snapshot of snapshots) {
    if (!snapshot.seller_id) continue;
    queryClient.setQueryData(["admin-seller-detail", snapshot.seller_id], (old: UntypedValue) =>
      updateAdminSellerDetail(old, snapshots, snapshot.seller_id)
    );
  }
}

// Convierte el payload crudo de Supabase Realtime en un resultado compatible.
export function stockMutationResultFromRealtime(payload: UntypedValue): StockMutationResult | null {
  const row = payload?.new;
  const snapshot = row?.snapshot_after as StockSnapshot | undefined;
  if (!snapshot) return null;

  return {
    success: true,
    mutation_id: row.id,
    snapshots: [snapshot],
    events: [{
      id: row.id,
      action: row.action,
      snapshot_after: snapshot,
    }],
  };
}
