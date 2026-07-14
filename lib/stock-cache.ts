import type { QueryClient } from "@tanstack/react-query";
import type { AdminSellerInfo, BookInventoryInfo, SellerInventory, SellerSale } from "@/types/seller";
import type { StockMutationResult, StockSnapshot } from "@/types/stock";

type StockCacheOptions = {
  sellerId?: string | null;
  adminId?: string | null;
};

type VersionedCacheRow = {
  updated_at?: string | null;
  stock_version?: string | null;
};

type InventoryCacheItem = SellerInventory & VersionedCacheRow & {
  seller?: { id: string; email: string } | null;
};

type AdminStockCacheRow = VersionedCacheRow & {
  book_id: string;
  quantity: number;
};

type BookStockCacheRow = VersionedCacheRow & {
  id: string;
  title?: string;
  author?: string | null;
  cover_url?: string | null;
  price_physical?: number | null;
  stock_physical?: number;
  stock_total?: number;
  stock_warehouse?: number;
  stock_assigned?: number;
};

type PaginatedCache<T> = {
  data: T[];
  total: number;
  page?: number;
  perPage?: number;
};

type VendedorDashboardCache = {
  inventory: InventoryCacheItem[];
  sales: SellerSale[];
  pendingPayment: number;
  role?: string;
};

type AdminDashboardCache = {
  adminUserId?: string;
  sales?: PaginatedCache<StockSale>;
  pendingSales?: StockSale[];
  salesMap?: Record<string, number>;
  topBooks?: Record<TopBooksPeriod, TopBook[]>;
  adminStock: AdminStockCacheRow[];
  physicalBooks: BookStockCacheRow[];
  inventory: PaginatedCache<InventoryCacheItem>;
};

type AdminSellerDetailCache = {
  inventory: InventoryCacheItem[];
};

type AdminBooksResponseCache = {
  books: BookStockCacheRow[];
};

type RequestableBooksResponseCache = {
  books: BookStockCacheRow[];
};

type StockRealtimePayload = {
  new?: {
    id?: string;
    action?: string;
    sale_id?: string | null;
    snapshot_after?: StockSnapshot | null;
  };
};

type StockSale = SellerSale & { admin_id?: string | null };
type TopBooksPeriod = "currentMonth" | "last30Days" | "all";
type TopBook = {
  book_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  units: number;
  revenue: number;
  sales: number;
  lastSoldAt: string | null;
};

function snapshotTime(snapshot: StockSnapshot) {
  const parsed = Date.parse(snapshot.version || snapshot.updated_at || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowTime(row: VersionedCacheRow) {
  const raw = row.stock_version || row.updated_at;
  const parsed = Date.parse(raw || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldApplySnapshot(row: VersionedCacheRow, snapshot: StockSnapshot) {
  const current = rowTime(row);
  const next = snapshotTime(snapshot);
  return current === 0 || next === 0 || next >= current;
}

function inventoryBook(snapshot: StockSnapshot, previous?: InventoryCacheItem | null): BookInventoryInfo | null {
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
  inventory: InventoryCacheItem[] | undefined,
  snapshots: StockSnapshot[],
  sellerId?: string | null
) {
  let next = [...(inventory ?? [])];

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

    const updated: InventoryCacheItem = {
      ...(existing ?? {
        id: `snapshot-${snapshot.seller_id}-${snapshot.book_id}`,
        seller_id: snapshot.seller_id,
        book_id: snapshot.book_id,
        updated_at: snapshot.updated_at,
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

  return next;
}

function updateAdminStockRows(rows: AdminStockCacheRow[] | undefined, snapshots: StockSnapshot[]) {
  const next = [...(rows ?? [])];

  for (const snapshot of snapshots) {
    if (!snapshot.admin_id) continue;
    const index = next.findIndex((row) => row.book_id === snapshot.book_id);
    const updated: AdminStockCacheRow = {
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

function updateBookStockRows(
  rows: BookStockCacheRow[] | undefined,
  snapshots: StockSnapshot[],
  mode: "total" | "warehouse"
) {
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

    const updated: BookStockCacheRow = {
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

function updateVendedorDashboard(
  old: VendedorDashboardCache | undefined,
  snapshots: StockSnapshot[],
  result?: StockMutationResult,
  sellerId?: string | null
) {
  if (!old) return old;

  const nextInventory = updateSellerInventoryList(old.inventory, snapshots, sellerId);
  let nextSales = old.sales ?? [];
  let pendingPayment = old.pendingPayment ?? 0;
  const sale = result?.sale;

  if (sale && (!sellerId || sale.seller_id === sellerId)) {
    const exists = nextSales.some((item) => item.id === sale.id);
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

function saleBelongsToAdminDashboard(old: AdminDashboardCache, sale: StockSale) {
  if (!old.adminUserId) return true;
  return sale.admin_id === old.adminUserId || sale.seller_id === old.adminUserId || sale.admin_id === null;
}

function addSaleToTopBooks(topBooks: TopBook[] | undefined, sale: StockSale, since?: Date) {
  if (!sale.book_id) return topBooks ?? [];
  const soldAt = sale.sold_at ? new Date(sale.sold_at) : null;
  if (since && (!soldAt || soldAt < since)) return topBooks ?? [];

  const rows = [...(topBooks ?? [])];
  const index = rows.findIndex((book) => book.book_id === sale.book_id);
  const book = sale.books;
  const quantity = Number(sale.quantity || 0);
  const revenue = quantity * Number(sale.sale_price || 0);

  if (index >= 0) {
    rows[index] = {
      ...rows[index],
      units: rows[index].units + quantity,
      revenue: rows[index].revenue + revenue,
      sales: rows[index].sales + 1,
      lastSoldAt: !rows[index].lastSoldAt || new Date(sale.sold_at) > new Date(rows[index].lastSoldAt)
        ? sale.sold_at
        : rows[index].lastSoldAt,
    };
  } else {
    rows.push({
      book_id: sale.book_id,
      title: book?.title || "Libro",
      author: book?.author ?? null,
      cover_url: book?.cover_url ?? null,
      units: quantity,
      revenue,
      sales: 1,
      lastSoldAt: sale.sold_at,
    });
  }

  return rows
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue || b.sales - a.sales)
    .slice(0, 10);
}

function addSaleToAdminTopBooks(topBooks: AdminDashboardCache["topBooks"], sale: StockSale) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return {
    currentMonth: addSaleToTopBooks(topBooks?.currentMonth, sale, currentMonthStart),
    last30Days: addSaleToTopBooks(topBooks?.last30Days, sale, last30Days),
    all: addSaleToTopBooks(topBooks?.all, sale),
  };
}

function updateAdminDashboard(
  old: AdminDashboardCache | undefined,
  snapshots: StockSnapshot[],
  result?: StockMutationResult
) {
  if (!old) return old;

  const previousInventory = old.inventory?.data ?? [];
  const nextInventory = updateSellerInventoryList(previousInventory, snapshots);
  const totalDelta = nextInventory.length - previousInventory.length;
  const sale = result?.sale as StockSale | undefined;
  const shouldAddSale = !!sale && saleBelongsToAdminDashboard(old, sale);
  const saleExists = shouldAddSale
    ? old.sales?.data?.some((item) => item.id === sale.id)
    : true;
  const salesMapKey = shouldAddSale && sale?.book_id ? `${sale.seller_id}:${sale.book_id}` : null;

  return {
    ...old,
    adminStock: updateAdminStockRows(old.adminStock, snapshots),
    physicalBooks: updateBookStockRows(old.physicalBooks, snapshots, "total"),
    sales: old.sales && shouldAddSale && !saleExists
      ? {
          ...old.sales,
          data: [sale, ...old.sales.data].slice(0, old.sales.perPage ?? old.sales.data.length + 1),
          total: old.sales.total + 1,
        }
      : old.sales,
    pendingSales: shouldAddSale && !saleExists && !sale?.paid_at
      ? [sale, ...(old.pendingSales ?? [])]
      : old.pendingSales,
    salesMap: salesMapKey
      ? {
          ...(old.salesMap ?? {}),
          [salesMapKey]: (old.salesMap?.[salesMapKey] ?? 0) + (sale?.quantity ?? 0),
        }
      : old.salesMap,
    topBooks: shouldAddSale && !saleExists && sale
      ? addSaleToAdminTopBooks(old.topBooks, sale)
      : old.topBooks,
    inventory: old.inventory
      ? {
          ...old.inventory,
          data: nextInventory,
          total: Math.max(0, (old.inventory.total ?? nextInventory.length) + totalDelta),
        }
      : old.inventory,
  };
}

function updateAdminSellerDetail(
  old: AdminSellerDetailCache | undefined,
  snapshots: StockSnapshot[],
  sellerId: string | null
) {
  if (!old || !sellerId) return old;
  return {
    ...old,
    inventory: updateSellerInventoryList(old.inventory, snapshots, sellerId),
  };
}

function updateAdminSellers(old: AdminSellerInfo[] | undefined, snapshots: StockSnapshot[]) {
  if (!old) return old;

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

function updateAdminBooksResponse(old: AdminBooksResponseCache | undefined, snapshots: StockSnapshot[]) {
  if (!old?.books) return old;
  return {
    ...old,
    books: updateBookStockRows(old.books, snapshots, "total"),
  };
}

function updateRequestableBooksResponse(old: RequestableBooksResponseCache | undefined, snapshots: StockSnapshot[]) {
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
    ? result.events.flatMap((event) => event.snapshot_after ? [event.snapshot_after] : [])
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
    queryClient.setQueryData<VendedorDashboardCache | undefined>(["vendedor-dashboard", options.sellerId], (old) =>
      updateVendedorDashboard(old, snapshots, result ?? undefined, options.sellerId)
    );
  }

  queryClient.setQueriesData<AdminDashboardCache | undefined>({ queryKey: ["admin-dashboard"] }, (old) =>
    updateAdminDashboard(old, snapshots, result ?? undefined)
  );

  queryClient.setQueriesData<AdminBooksResponseCache | undefined>({ queryKey: ["admin-books"] }, (old) =>
    updateAdminBooksResponse(old, snapshots)
  );

  queryClient.setQueriesData<BookStockCacheRow[] | undefined>({ queryKey: ["physical-books"] }, (old) =>
    updateBookStockRows(old, snapshots, "warehouse")
  );

  queryClient.setQueriesData<RequestableBooksResponseCache | undefined>({ queryKey: ["requestable-books"] }, (old) =>
    updateRequestableBooksResponse(old, snapshots)
  );

  queryClient.setQueriesData<AdminSellerInfo[] | undefined>({ queryKey: ["admin-sellers"] }, (old) =>
    updateAdminSellers(old, snapshots)
  );

  for (const snapshot of snapshots) {
    if (!snapshot.seller_id) continue;
    queryClient.setQueryData<AdminSellerDetailCache | undefined>(["admin-seller-detail", snapshot.seller_id], (old) =>
      updateAdminSellerDetail(old, snapshots, snapshot.seller_id)
    );
  }
}

function isStockRealtimePayload(payload: unknown): payload is StockRealtimePayload {
  return typeof payload === "object" && payload !== null && "new" in payload;
}

// Convierte el payload crudo de Supabase Realtime en un resultado compatible.
export function stockMutationResultFromRealtime(payload: unknown): StockMutationResult | null {
  if (!isStockRealtimePayload(payload)) return null;

  const row = payload.new;
  const snapshot = row?.snapshot_after;
  if (!snapshot) return null;

  return {
    success: true,
    mutation_id: row.id,
    snapshots: [snapshot],
    events: [{
      id: row.id ?? "",
      action: row.action ?? "stock_event",
      snapshot_after: snapshot,
    }],
  };
}
