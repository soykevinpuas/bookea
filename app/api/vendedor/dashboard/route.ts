import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { getSellerInventory, getSellerSales, getSellerRequests, getSellerPendingTotal } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: roleData } = await supabase.rpc('get_my_role');
    const role = roleData as string;

    if (role !== 'vendedor' && role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const [inventory, sales, requests, pendingPayment] = await Promise.all([
      getSellerInventory(supabase, user.id),
      getSellerSales(supabase, user.id),
      getSellerRequests(supabase, user.id),
      role === 'admin' ? Promise.resolve(0) : getSellerPendingTotal(supabase, user.id),
    ]);

    // El costo es privado por admin y solo se adjunta cuando el propio admin usa la vista vendedor.
    if (role === 'admin' && inventory.length > 0) {
      const { data: costs, error: costsError } = await supabase
        .from('admin_book_costs')
        .select('book_id, acquisition_cost')
        .eq('admin_id', user.id)
        .in('book_id', inventory.map((item) => item.book_id));
      if (costsError) throw costsError;

      const costByBook = new Map(
        (costs ?? []).map((row) => [row.book_id, Number(row.acquisition_cost)])
      );
      for (const item of inventory) {
        if (item.books) item.books.acquisition_cost = costByBook.get(item.book_id) ?? 100;
      }
    }

    return NextResponse.json({
      inventory,
      sales,
      requests,
      pendingPayment,
      role,
    });
  } catch (error) {
    console.error('[api/vendedor/dashboard] Error:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los datos de la tienda. Intenta de nuevo.' },
      { status: 503 }
    );
  }
}
