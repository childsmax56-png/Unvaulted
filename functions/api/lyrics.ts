// Genius song info for the lyrics modal, via the official Genius API only.
// Lyrics text comes from lrclib on the client — Genius doesn't offer lyrics through its API
// and blocks automated fetching of its pages, so we don't scrape them.
// Responds { geniusUrl, annotations, songInfo } or { geniusUrl: null, reason }.
const json = (body: unknown, cache = false) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      ...(cache ? { 'Cache-Control': 'public, max-age=86400' } : {}),
    },
  });

const norm = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const artist = url.searchParams.get('artist')?.trim();
  const track = url.searchParams.get('track')?.trim();

  if (!artist || !track) {
    return new Response(JSON.stringify({ error: 'Missing artist or track' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = context.env.GENIUS_TOKEN;
  if (!token) return json({ geniusUrl: null, reason: 'no-token' });

  try {
    const apiHeaders = { Authorization: `Bearer ${token}` };

    const searchRes = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`,
      { headers: apiHeaders }
    );
    if (!searchRes.ok) return json({ geniusUrl: null, reason: `search-${searchRes.status}` });

    const searchData: any = await searchRes.json();
    const hits: any[] = (searchData?.response?.hits ?? []).filter((h: any) => h.type === 'song');

    // Only accept a hit whose title matches the track — unreleased songs usually aren't on
    // Genius, and the top search hit would otherwise attach some other song's info.
    const wantTrack = norm(track);
    const wantArtist = norm(artist);
    const hit = hits.find((h: any) => {
      const title = norm(h.result?.title ?? '');
      const by = norm(h.result?.primary_artist?.name ?? '') + ' ' + norm(h.result?.artist_names ?? '');
      const titleOk = !!title && (title === wantTrack || title.startsWith(wantTrack + ' ') || wantTrack.startsWith(title + ' '));
      const artistOk = by.includes(wantArtist) || wantArtist.split(' ').some(w => w.length > 2 && by.includes(w));
      return titleOk && artistOk;
    });
    if (!hit) return json({ geniusUrl: null, reason: 'no-match' }, true);

    const songId: number = hit.result.id;
    const [referentsRes, songDetailsRes] = await Promise.all([
      fetch(`https://api.genius.com/referents?song_id=${songId}&text_format=plain&per_page=50`, { headers: apiHeaders }),
      fetch(`https://api.genius.com/songs/${songId}?text_format=plain`, { headers: apiHeaders }),
    ]);

    const [annotations, songInfo] = await Promise.all([
      extractAnnotations(referentsRes),
      extractSongInfo(songDetailsRes),
    ]);

    return json({ geniusUrl: hit.result.url as string, annotations, songInfo }, true);
  } catch {
    return json({ geniusUrl: null, reason: 'error' });
  }
};

async function extractAnnotations(res: Response): Promise<{ fragment: string; body: string }[]> {
  try {
    if (!res.ok) return [];
    const data: any = await res.json();
    const referents: any[] = data?.response?.referents ?? [];
    return referents
      .filter((r: any) => r.annotations?.length > 0 && r.fragment?.trim())
      .map((r: any) => {
        const sorted = [...r.annotations].sort((a: any, b: any) => (b.votes_total ?? 0) - (a.votes_total ?? 0));
        const body: string = sorted[0]?.body?.plain?.trim() ?? '';
        return body ? { fragment: r.fragment.trim(), body } : null;
      })
      .filter(Boolean) as { fragment: string; body: string }[];
  } catch {
    return [];
  }
}

interface SongInfo {
  description: string | null;
  producers: string[];
  writers: string[];
  samples: { title: string; artist: string }[];
  annotationCount: number;
}

async function extractSongInfo(res: Response): Promise<SongInfo | null> {
  try {
    if (!res.ok) return null;
    const data: any = await res.json();
    const song = data?.response?.song;
    if (!song) return null;

    const description = song.description?.plain?.trim() ?? '';
    const customPerfs: any[] = song.custom_performances ?? [];
    const producerPerf = customPerfs.find((p: any) => p.label?.toLowerCase().includes('produc'));
    const writerPerf = customPerfs.find((p: any) => p.label?.toLowerCase().includes('writ'));
    const producers: string[] = (producerPerf?.artists ?? song.producer_artists ?? []).map((a: any) => a.name).filter(Boolean);
    const writers: string[] = (writerPerf?.artists ?? song.writer_artists ?? []).map((a: any) => a.name).filter(Boolean);
    const samplesRel = (song.song_relationships ?? []).find((r: any) => r.type === 'samples');
    const samples: { title: string; artist: string }[] = (samplesRel?.songs ?? []).map((s: any) => ({
      title: s.title ?? '',
      artist: s.primary_artist?.name ?? '',
    }));

    return {
      description: description && description !== '?' ? description : null,
      producers,
      writers,
      samples,
      annotationCount: song.annotation_count ?? 0,
    };
  } catch {
    return null;
  }
}
