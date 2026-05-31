import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verificar que el usuario autenticado es admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar rol admin
    const { data: adminCheck } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminCheck?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 3. Obtener datos del body
    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!['free', 'subscriber', 'admin', 'vendedor'].includes(newRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    // 4. Usar adminClient (service_role) para bypassear RLS completamente
    const adminDb = createAdminClient();

    const { data: updateResult, error: updateError } = await adminDb
      .from('users')
      .update({ role: newRole })
      .eq('id', targetUserId)
      .select('id, email, role')
      .single();

    if (updateError) {
      console.error('[admin/update-role] Error con adminClient:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      method: 'admin_client',
      updatedUser: updateResult,
    });

  } catch (err: any) {
    console.error('[admin/update-role] Error inesperado:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
