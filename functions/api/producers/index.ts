// GET /api/producers — every credited person (lead artists, producers,
// featured artists, reference vocalists) across all public trackers, sorted by song count.
// Each entry: { k: key, n: name, c: unique songs, v: version rows,
// a: { slug: unique songs }, l/p/f/r: unique songs as lead artist / produced /
// featured on (feat. + with) / reference vocals }.
import { cached, displayName, loadAllShards, songKey } from './_index';

export interface ProducerSummary {
  k: string;
  n: string;
  c: number;
  v: number;
  a: Record<string, number>;
  l: number;
  p: number;
  f: number;
  r: number;
}

// Row role letters → summary bucket ("w" with-credits count as features).
const BUCKET: Record<string, 'l' | 'p' | 'f' | 'r'> = { a: 'l', p: 'p', f: 'f', w: 'f', r: 'r' };

export const onRequestGet: PagesFunction = async (context) => {
  const origin = new URL(context.request.url).origin;
  return cached(context.request, context.waitUntil.bind(context), 'list', async () => {
    const { songs, names } = await loadAllShards(origin);
    const byKey = new Map<string, ProducerSummary>();
    const seen = new Set<string>(); // `${person}|${scope}|${song}` dedupe for every counter
    const once = (id: string) => (seen.has(id) ? false : (seen.add(id), true));
    for (const song of songs) {
      const sk = songKey(song.n);
      song.p.forEach((k, i) => {
        let entry = byKey.get(k);
        if (!entry) {
          entry = { k, n: displayName(names[k] ?? {}), c: 0, v: 0, a: {}, l: 0, p: 0, f: 0, r: 0 };
          byKey.set(k, entry);
        }
        entry.v++;
        if (once(`${k}|*|${sk}`)) entry.c++;
        if (once(`${k}|@${song.s}|${sk}`)) entry.a[song.s] = (entry.a[song.s] ?? 0) + 1;
        for (const b of new Set([...(song.r?.[i] ?? 'p')].map((ch) => BUCKET[ch]))) {
          if (b && once(`${k}|${b}|${sk}`)) entry[b]++;
        }
      });
    }
    const producers = [...byKey.values()]
      .filter((p) => p.n)
      .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
    return { producers, total_songs: songs.length, generated_at: Date.now() };
  });
};
