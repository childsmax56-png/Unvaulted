// GET /api/producers/:key — every credited song for one producer across all
// public trackers, plus their most frequent collaborators.
import { cached, displayName, loadAllShards, producerKey } from './_index';

export const onRequestGet: PagesFunction = async (context) => {
  const origin = new URL(context.request.url).origin;
  // Accept either a key or a raw name ("Metro Boomin") — both normalize the same.
  const key = producerKey(decodeURIComponent(String(context.params.key ?? '')));
  if (!key) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });

  return cached(context.request, context.waitUntil.bind(context), `p-${key}`, async () => {
    const { songs, names } = await loadAllShards(origin);
    const mine = songs.filter((s) => s.p.includes(key));

    const collab = new Map<string, number>();
    for (const s of mine) for (const k of s.p) if (k !== key) collab.set(k, (collab.get(k) ?? 0) + 1);
    const collaborators = [...collab.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([k, c]) => ({ k, n: displayName(names[k] ?? {}), c }));

    const variants = names[key] ?? {};
    return {
      key,
      name: displayName(variants),
      aliases: Object.keys(variants),
      songs: mine,
      collaborators,
      generated_at: Date.now(),
    };
  });
};
