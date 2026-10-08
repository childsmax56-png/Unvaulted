// GET /api/og/card?path=/vampgold/album/x?song=y → share-card data (see _card.ts).
// Read by the og-image Worker; edge-cached for an hour.
import { buildCard } from './_card';

export const onRequestGet: PagesFunction = async ({ request, waitUntil }) => {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') || '';
  if (!path.startsWith('/') || path.length > 6000) return new Response('Bad path', { status: 400 });

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(`${url.origin}/api/og/card?path=${encodeURIComponent(path)}&v=1`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const card = await buildCard(url.origin, path);
  const res = new Response(JSON.stringify(card), {
    status: card ? 200 : 404,
    headers: {
      'Content-Type': 'application/json',
      // Profiles change as people listen; everything else is catalog data.
      'Cache-Control': !card ? 'public, max-age=300' : card.kind === 'profile' ? 'public, max-age=600' : 'public, max-age=3600',
    },
  });
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
