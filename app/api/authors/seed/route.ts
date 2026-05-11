import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { fetchAuthorFromWikipedia } from '@/lib/wikipedia';

export async function POST() {
  try {
    const supabase = await createClient();
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
        const update: Record<string, any> = { bio: result.bio };
        if (result.photoUrl) update.photo_url = result.photoUrl;
        await supabase.from('authors').update(update).eq('id', author.id);
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
