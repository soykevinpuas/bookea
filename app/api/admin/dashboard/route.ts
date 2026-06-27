import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

function safeParseInt(val: string | null, def: number): number {
  const n = parseInt(val || '', 10);
  return Number.isNaN(n) ? def : n;
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
    ]);

    const salesMap: Record<string, number> = {};
    for (const s of (salesMapResult.data ?? [])) {
      const key = `${s.seller_id}:${s.book_id}`;
      salesMap[key] = (salesMap[key] || 0) + (s.quantity || 0);
    }

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
    });
  } catch (error) {
    console.error('[api/admin/dashboard] Error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
