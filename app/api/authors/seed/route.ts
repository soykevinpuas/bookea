import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { fetchAuthorFromWikipedia } from '@/lib/wikipedia';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error inesperado';
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Se requiere admin' }, { status: 403 });

    // Obtener TODOS los autores, no solo sin bio
    const { data: authors, error } = await supabase
      .from('authors')
      .select('id, name, bio, photo_url');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!authors?.length) return NextResponse.json({ updated: 0, failed: 0, message: 'No hay autores en la base de datos' });

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const author of authors) {
      // Saltar si ya tiene bio y foto
      if (author.bio && author.photo_url) {
        skipped++;
        continue;
      }

      const result = await fetchAuthorFromWikipedia(author.name);
      if (result?.bio) {
        let photo_url: string | null = null;
        if (result.photoUrl) {
          try {
            const imgRes = await fetch(result.photoUrl);
            const blob = await imgRes.blob();
            const ext = result.photoUrl.split('.').pop()?.split('?')[0] || 'jpg';
            const path = `authors/${author.id}.${ext}`;
            await supabase.storage.from('covers').upload(path, blob, { upsert: true });
            const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
            photo_url = pub?.publicUrl || result.photoUrl;
          } catch {
            photo_url = result.photoUrl;
          }
        }
        await supabase.from('authors').update({ bio: result.bio, photo_url }).eq('id', author.id);
        updated++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ updated, failed, skipped, total: authors.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
