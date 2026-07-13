import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/server';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error inesperado';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar que el usuario autenticado es admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar rol admin vía RPC (SECURITY DEFINER, bypass RLS)
    const { data: roleData } = await supabase.rpc('get_my_role');
    if (roleData !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Obtener datos del body
    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (!['free', 'subscriber', 'admin', 'vendedor'].includes(newRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    // Usar adminClient (service_role) para bypassear RLS completamente
    const adminDb = createAdminClient();

    const updatePayload: { role: string; assigned_admin_id?: string } = { role: newRole };
    if (newRole === 'vendedor') {
      updatePayload.assigned_admin_id = user.id;
    }

    const { data: updateResult, error: updateError } = await adminDb
      .from('users')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select('id, email, role, assigned_admin_id')
      .single();

    if (updateError) {
      console.error('[admin/update-role] Error con adminClient:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Asegurar que el usuario tiene un perfil
    const { data: existingProfile } = await adminDb
      .from('profiles')
      .select('id')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await adminDb
        .from('profiles')
        .insert({ user_id: targetUserId, id: targetUserId });

      if (profileError) {
        console.error('[admin/update-role] Error creando profile:', profileError);
      }
    }

    return NextResponse.json({
      success: true,
      method: 'admin_client',
      updatedUser: updateResult,
    });

  } catch (err: unknown) {
    console.error('[admin/update-role] Error inesperado:', err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
