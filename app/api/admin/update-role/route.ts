import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

// ============================================
// API Route: Cambio de rol desde panel admin
// Usa el servidor (cookies de sesión) para autenticar al admin,
// luego ejecuta el RPC con SECURITY DEFINER para bypasear RLS
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 1. Verificar que el usuario autenticado es admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Verificar rol admin directamente
    const { data: adminCheck, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminError || adminCheck?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 3. Obtener datos del body
    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!['free', 'subscriber', 'admin'].includes(newRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    // 4. Intentar vía RPC primero (SECURITY DEFINER bypasea RLS)
    const { error: rpcError } = await supabase.rpc('admin_change_user_role', {
      target_user_id: targetUserId,
      new_role: newRole,
    });

    if (rpcError) {
      // Si el RPC no existe, intentar update directo (el admin ya tiene policy FOR ALL)
      console.warn('[admin/update-role] RPC falló, intentando update directo:', rpcError.message);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', targetUserId)
        .select('id, role');

      if (updateError) {
        console.error('[admin/update-role] Update directo también falló:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('[admin/update-role] Update devolvió 0 filas - RLS bloqueó silenciosamente');
        return NextResponse.json({ 
          error: 'La base de datos rechazó el cambio. Ejecuta el SQL de 008_rpc_admin_actions.sql en Supabase.' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        method: 'direct_update',
        updatedUser: updateResult[0] 
      });
    }

    // 5. Verificar que el cambio realmente se aplicó
    const { data: verify } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', targetUserId)
      .single();

    return NextResponse.json({ 
      success: true, 
      method: 'rpc',
      updatedUser: verify 
    });

  } catch (err: any) {
    console.error('[admin/update-role] Error inesperado:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
