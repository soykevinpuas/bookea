import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export async function GET() {
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

    const [
      { data: allSales },
      { data: allInventory },
      { data: allSellers },
      { data: requests },
      { data: pendingSales },
      { data: physicalBooks },
    ] = await Promise.all([
      supabase.from("seller_sales")
        .select("*, books(id, title, author, cover_url), seller:seller_id(id, email), profile:seller_id(name)")
        .order("sold_at", { ascending: false }),
      supabase.from("seller_inventory")
        .select("*, books(id, title, cover_url, author)")
        .order("updated_at", { ascending: false }),
      supabase.from("users").select("id, email").eq("role", "vendedor"),
      supabase.from("stock_requests")
        .select("*, items:stock_request_items(*, books(id, title, author, cover_url, price_physical)), seller:seller_id(id, email)")
        .order("created_at", { ascending: false }),
      supabase.from("seller_sales")
        .select("*, books(id, title, author, cover_url, price_physical), seller:seller_id(id, email), profile:seller_id(name)")
        .is("paid_at", null)
        .order("sold_at", { ascending: false }),
      supabase.from("books")
        .select("id, title, author, cover_url, price_physical, stock_physical")
        .eq("is_active", true)
        .gt("price_physical", 0)
        .order("title", { ascending: true }),
    ]);

    return NextResponse.json({
      allSales: allSales ?? [],
      allInventory: allInventory ?? [],
      allSellers: allSellers ?? [],
      requests: requests ?? [],
      pendingSales: pendingSales ?? [],
      physicalBooks: physicalBooks ?? [],
    });
  } catch (error) {
    console.error('[api/admin/dashboard] Error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
