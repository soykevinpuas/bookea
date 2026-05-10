import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: 'Error al eliminar la cuenta' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in account delete:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
