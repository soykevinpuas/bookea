import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { fetchAuthorFromWikipedia } from '@/lib/wikipedia';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: roleData } = await supabase.rpc('get_my_role');
    if (roleData !== 'admin') return NextResponse.json({ error: 'Se requiere admin' }, { status: 403 });

    const { data: authors, error } = await supabase
      .from('authors')
      .select('id, name')
      .is('bio', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!authors?.length) return NextResponse.json({ message: 'Todos los autores ya tienen bio' });

    let updated = 0;
    let failed = 0;

    for (const author of authors) {
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

    return NextResponse.json({ updated, failed, total: authors.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
