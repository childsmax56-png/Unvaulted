// GET /api/producers — every credited producer across all public trackers,
// sorted by song count. Each entry: { k: key, n: name, c: unique songs,
// v: version rows, a: { slug: unique songs } }.
import { cached, displayName, loadAllShards, songKey } from './_index';

export interface ProducerSummary {
  k: string;
  n: string;
  c: number;
  v: number;
  a: Record<string, number>;
}

export const onRequestGet: PagesFunction = async (context) => {
  const origin = new URL(context.request.url).origin;
  return cached(context.request, context.waitUntil.bind(context), 'list', async () => {
    const { songs, names } = await loadAllShards(origin);
    const byKey = new Map<string, ProducerSummary>();
    const seen = new Map<string, Set<string>>(); // producer key -> unique song keys
    const seenPerArtist = new Set<string>();     // `${producer}|${slug}|${song}`
    for (const song of songs) {
      const sk = songKey(song.n);
      for (const k of song.p) {
        let entry = byKey.get(k);
        if (!entry) {
          entry = { k, n: displayName(names[k] ?? {}), c: 0, v: 0, a: {} };
          byKey.set(k, entry);
          seen.set(k, new Set());
        }
        entry.v++;
        const mine = seen.get(k)!;
        if (!mine.has(sk)) { mine.add(sk); entry.c++; }
        const ak = `${k}|${song.s}|${sk}`;
        if (!seenPerArtist.has(ak)) { seenPerArtist.add(ak); entry.a[song.s] = (entry.a[song.s] ?? 0) + 1; }
      }
    }
    const producers = [...byKey.values()]
      .filter((p) => p.n)
      .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
    return { producers, total_songs: songs.length, generated_at: Date.now() };
  });
};
