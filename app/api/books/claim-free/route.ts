import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/server';

// Permite reclamar libros no premium usando cliente admin, no escritura directa del cliente.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminDb = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión para reclamar este libro.' }, { status: 401 });
    }

    const body = await request.json();
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json({ error: 'Book ID requerido' }, { status: 400 });
    }

    // Solo libros no premium pueden reclamarse gratis.
    const { data: book, error: bookError } = await adminDb
      .from('books')
      .select('is_premium, price_digital')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Libro no encontrado en la base de datos' }, { status: 404 });
    } else if (book.is_premium) {
      return NextResponse.json({ error: 'Este libro es Premium y no puede reclamarse gratis.' }, { status: 403 });
    }

    const { data: existingAccess } = await adminDb
      .from('user_books')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .maybeSingle();

    if (existingAccess) {
      return NextResponse.json({ alreadyClaimed: true, message: 'Ya tienes acceso a este libro' }, { status: 200 });
    }

    // La constraint UNIQUE en DB actua como respaldo contra carreras.
    const { error: insertError } = await adminDb
      .from('user_books')
      .insert({
        user_id: user.id,
        book_id: bookId,
        access_type: 'permanent',
      });

    if (insertError) {
      // 23505 es unique_violation en PostgreSQL.
      if (insertError.code === '23505') {
        return NextResponse.json({ alreadyClaimed: true, message: 'Ya tienes acceso a este libro' }, { status: 200 });
      }
      console.error('Error insertando user_books:', insertError);
      return NextResponse.json({ error: 'Fallo al añadir el libro a tu biblioteca' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '¡Libro reclamado con éxito!' });
  } catch (error) {
    console.error('Error reclamando libro gratis:', error);
    return NextResponse.json(
      { error: 'Error inesperado del servidor' },
      { status: 500 }
    );
  }
}
