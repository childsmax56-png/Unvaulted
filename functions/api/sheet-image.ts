// GET /api/sheet-image?u=<token> — serves a Google Sheets in-cell image
// (https://docs.google.com/sheets-images-rt/<token>) from our origin.
//
// Those URLs load fine without cookies, but a browser sends its Google cookies
// to docs.google.com and the image then fails for anyone signed into Google —
// so live era covers / Art-tab images (see [artist]/_htmlview.ts) go through
// here. Only sheets-images-rt tokens are accepted, so this isn't an open proxy.

const TTL = 24 * 60 * 60;

export const onRequestGet: PagesFunction = async (context) => {
  const token = new URL(context.request.url).searchParams.get('u') ?? '';
  if (!/^[A-Za-z0-9_-]{20,}(=[A-Za-z0-9-]+)?$/.test(token)) {
    return new Response('Bad image token', { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://sheet-image.cache/${token}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const upstream = await fetch(`https://docs.google.com/sheets-images-rt/${token}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
  });
  const type = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !type.startsWith('image/')) {
    return new Response('Image unavailable', { status: 502, headers: { 'Cache-Control': 'public, max-age=60' } });
  }

  const res = new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=${TTL}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
