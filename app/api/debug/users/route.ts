import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

// TEMPORAL: Endpoint de diagnóstico para verificar qué rol tiene un usuario en la BD
// BORRAR después de resolver el bug
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // Obtener todos los usuarios y sus roles
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role, subscription_ends_at');

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    error: error?.message || null,
    users: users?.map(u => ({
      email: u.email,
      role: u.role,
      subscription_ends_at: u.subscription_ends_at,
    })) || [],
  });
}
