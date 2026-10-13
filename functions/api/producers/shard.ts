// GET /api/producers/shard?i=N — indexes SHARD_SIZE trackers' producer credits.
// Internal building block for /api/producers and /api/producers/:key.
import { PRODUCER_SLUGS, SHARD_SIZE, SHARD_COUNT, cached, indexCatalog, type ShardPayload } from './_index';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const i = Number(url.searchParams.get('i'));
  if (!Number.isInteger(i) || i < 0 || i >= SHARD_COUNT) {
    return new Response(JSON.stringify({ error: 'bad shard' }), { status: 400 });
  }

  return cached(context.request, context.waitUntil.bind(context), `shard-${i}`, async () => {
    const payload: ShardPayload = { songs: [], names: {} };
    const slugs = PRODUCER_SLUGS.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE);
    const catalogs = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const res = await fetch(`${url.origin}/api/${slug}/a`);
          return res.ok ? { slug, data: await res.json() as { eras?: Record<string, any> } } : null;
        } catch {
          return null;
        }
      }),
    );
    for (const c of catalogs) if (c) indexCatalog(c.slug, c.data, payload);
    return payload;
  });
};
