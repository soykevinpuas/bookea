import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { getSellerInventory, getSellerSales, getSellerRequests, getSellerPendingTotal } from '@/lib/sellers';

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

    return NextResponse.json({
      inventory,
      sales,
      requests,
      pendingPayment,
      role,
    });
  } catch (error) {
    console.error('[api/vendedor/dashboard] Error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
