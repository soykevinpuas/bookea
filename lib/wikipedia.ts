export async function fetchAuthorFromWikipedia(name: string): Promise<{
  bio: string | null;
  photoUrl: string | null;
  wikipediaUrl: string | null;
} | null> {
  try {
    const res = await fetch(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) return null;
    return {
      bio: data.extract ? data.extract.split('\n')[0].slice(0, 1000) : null,
      photoUrl: data.thumbnail?.source || null,
      wikipediaUrl: data.content_urls?.desktop?.page || null,
    };
  } catch {
    return null;
  }
}
