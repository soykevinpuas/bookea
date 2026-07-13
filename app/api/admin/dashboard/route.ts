import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

function safeParseInt(val: string | null, def: number): number {
  const n = parseInt(val || '', 10);
  return Number.isNaN(n) ? def : n;
}

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

type JoinedBook = {
  id?: string;
  title?: string | null;
  author?: string | null;
  cover_url?: string | null;
} | null;

type TopBookSaleRow = {
  book_id: string | null;
  quantity: number | null;
  sale_price: number | null;
  sold_at: string | null;
  books?: JoinedBook | JoinedBook[] | null;
};

type SalesMapRow = {
  seller_id: string | null;
  book_id: string | null;
  quantity: number | null;
};

function pickJoinedBook(books: TopBookSaleRow["books"]): JoinedBook {
  if (Array.isArray(books)) return books[0] ?? null;
  return books ?? null;
}

function buildTopBooks(sales: TopBookSaleRow[], since?: Date): TopBook[] {
  const map = new Map<string, TopBook>();
  const sinceMs = since?.getTime() ?? null;

  for (const sale of sales) {
    const bookId = sale.book_id;
    if (!bookId) continue;
    const soldAt = sale.sold_at ? new Date(sale.sold_at) : null;
    if (sinceMs !== null && (!soldAt || soldAt.getTime() < sinceMs)) continue;

    const qty = Number(sale.quantity || 0);
    if (qty <= 0) continue;

    const book = pickJoinedBook(sale.books);
    const existing = map.get(bookId) ?? {
      book_id: bookId,
      title: book?.title || "Libro",
      author: book?.author ?? null,
      cover_url: book?.cover_url ?? null,
      units: 0,
      revenue: 0,
      sales: 0,
      lastSoldAt: null,
    };

    existing.units += qty;
    existing.revenue += qty * Number(sale.sale_price || 0);
    existing.sales += 1;

    if (sale.sold_at && (!existing.lastSoldAt || new Date(sale.sold_at) > new Date(existing.lastSoldAt))) {
      existing.lastSoldAt = sale.sold_at;
    }

    map.set(bookId, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue || b.sales - a.sales)
    .slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: roleData } = await supabase.rpc('get_my_role');
    if (roleData !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);

    const salesPage = Math.max(1, safeParseInt(searchParams.get('salesPage'), 1));
    const salesPerPage = Math.min(500, Math.max(1, safeParseInt(searchParams.get('salesPerPage'), 100)));
    const inventoryPage = Math.max(1, safeParseInt(searchParams.get('inventoryPage'), 1));
    const inventoryPerPage = Math.min(500, Math.max(1, safeParseInt(searchParams.get('inventoryPerPage'), 200)));
    const requestsPage = Math.max(1, safeParseInt(searchParams.get('requestsPage'), 1));
    const requestsPerPage = Math.min(500, Math.max(1, safeParseInt(searchParams.get('requestsPerPage'), 50)));

    const salesFrom = (salesPage - 1) * salesPerPage;
    const salesTo = salesFrom + salesPerPage - 1;
    const invFrom = (inventoryPage - 1) * inventoryPerPage;
    const invTo = invFrom + inventoryPerPage - 1;
    const reqFrom = (requestsPage - 1) * requestsPerPage;
    const reqTo = reqFrom + requestsPerPage - 1;

    const adminId = user.id;

    const { data: adminSellers } = await adminClient
      .from("users")
      .select("id, email, assigned_admin_id")
      .eq("role", "vendedor")
      .or(`assigned_admin_id.eq.${adminId},assigned_admin_id.is.null`);

    const sellerIds = [adminId, ...(adminSellers ?? []).map(s => s.id)];

    const [
      physicalBooksResult,
      pendingSalesResult,
      salesResult,
      requestsResult,
      inventoryResult,
      salesMapResult,
      adminStockResult,
      topBookSalesResult,
    ] = await Promise.all([
      adminClient.from("books")
        .select("id, title, author, cover_url, price_physical, stock_physical")
        .eq("is_active", true)
        .gt("price_physical", 0)
        .order("title", { ascending: true }),

      adminClient.from("seller_sales")
        .select("*, books(id, title, author, cover_url, price_physical), seller:seller_id(id, email)")
        .or(`admin_id.eq.${adminId},and(admin_id.is.null,seller_id.in.(${sellerIds.join(',')}))`)
        .is("paid_at", null)
        .order("sold_at", { ascending: false })
        .limit(500),

      adminClient.from("seller_sales")
        .select("*, books(id, title, author, cover_url), seller:seller_id(id, email)", { count: "exact", head: false })
        .or(`admin_id.eq.${adminId},and(admin_id.is.null,seller_id.in.(${sellerIds.join(',')}))`)
        .order("sold_at", { ascending: false })
        .range(salesFrom, salesTo),

      sellerIds.length > 0
        ? adminClient.from("stock_requests")
            .select("*, items:stock_request_items(*, books(id, title, author, cover_url, price_physical)), seller:seller_id(id, email)", { count: "exact", head: false })
            .in("seller_id", sellerIds)
            .order("created_at", { ascending: false })
            .range(reqFrom, reqTo)
        : { data: [], count: 0 },

      sellerIds.length > 0
        ? adminClient.from("seller_inventory")
            .select("*, books(id, title, cover_url, author)", { count: "exact", head: false })
            .in("seller_id", sellerIds)
            .order("updated_at", { ascending: false })
            .range(invFrom, invTo)
        : { data: [], count: 0 },

      adminClient.from("seller_sales")
        .select("seller_id, book_id, quantity")
        .or(`admin_id.eq.${adminId},and(admin_id.is.null,seller_id.in.(${sellerIds.join(',')}))`)
        .not("book_id", "is", null)
        .gte("sold_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000),

      adminClient.from("admin_stock")
        .select("book_id, quantity")
        .eq("admin_id", adminId),

      adminClient.from("seller_sales")
        .select("book_id, quantity, sale_price, sold_at, books(id, title, author, cover_url)")
        .or(`admin_id.eq.${adminId},and(admin_id.is.null,seller_id.in.(${sellerIds.join(',')}))`)
        .not("book_id", "is", null)
        .order("sold_at", { ascending: false })
        .limit(2000),
    ]);

    const salesMap: Record<string, number> = {};
    for (const s of (salesMapResult.data ?? []) as SalesMapRow[]) {
      if (!s.seller_id || !s.book_id) continue;
      const key = `${s.seller_id}:${s.book_id}`;
      salesMap[key] = (salesMap[key] || 0) + (s.quantity || 0);
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const topBookSales = (topBookSalesResult.data ?? []) as TopBookSaleRow[];

    return NextResponse.json({
      adminUserId: adminId,
      sellers: adminSellers ?? [],
      physicalBooks: physicalBooksResult.data ?? [],
      adminStock: adminStockResult.data ?? [],
      pendingSales: pendingSalesResult.data ?? [],
      sales: {
        data: salesResult.data ?? [],
        total: salesResult.count ?? 0,
        page: salesPage,
        perPage: salesPerPage,
      },
      requests: {
        data: requestsResult.data ?? [],
        total: requestsResult.count ?? 0,
        page: requestsPage,
        perPage: requestsPerPage,
      },
      inventory: {
        data: inventoryResult.data ?? [],
        total: inventoryResult.count ?? 0,
        page: inventoryPage,
        perPage: inventoryPerPage,
      },
      salesMap,
      topBooks: {
        currentMonth: buildTopBooks(topBookSales, currentMonthStart),
        last30Days: buildTopBooks(topBookSales, last30Days),
        all: buildTopBooks(topBookSales),
      },
    });
  } catch (error) {
    console.error('[api/admin/dashboard] Error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
