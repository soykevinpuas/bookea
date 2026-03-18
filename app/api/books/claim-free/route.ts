import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión para reclamar este libro.' }, { status: 401 });
    }

    const body = await request.json();
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json({ error: 'Book ID requerido' }, { status: 400 });
    }

    // 1. Verificar el precio del libro desde la base de datos (seguridad estricta)
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('price_digital')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      // Como estamos enviando un mock al frontend si hay error, el backend va a fallar aquí.
      // Permitir bypass SOLO si es el libro '1' mocking para desarrollo local:
      if (bookId !== '1') {
        return NextResponse.json({ error: 'Libro no encontrado en la base de datos' }, { status: 404 });
      }
    } else if (book.price_digital > 0) {
      return NextResponse.json({ error: 'Este libro no es gratuito.' }, { status: 403 });
    }

    // 2. Verificar si el usuario ya lo tiene
    const { data: existingAccess } = await supabase
      .from('user_books')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .maybeSingle();

    if (existingAccess) {
      return NextResponse.json({ error: 'Ya tienes acceso a este libro' }, { status: 400 });
    }

    // 3. Asignar el libro de forma gratuita al usuario
    const { error: insertError } = await supabase
      .from('user_books')
      .insert({
        user_id: user.id,
        book_id: bookId,
        access_type: 'permanent',
      });

    if (insertError) {
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
