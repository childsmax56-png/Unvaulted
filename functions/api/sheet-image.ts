import { getSheetImageTokens } from './[artist]/_htmlview';

// GET /api/sheet-image?s=<sheetId>&g=<gid>&k=<key>&w=<width> — serves a Google
// Sheets in-cell image (live era covers / Art-tab images, see
// [artist]/_htmlview.ts) from our origin.
//
// Google's sheets-images-rt URLs carry a token that rotates every few minutes
// (old ones 403) and are CORP same-site (blocked in browsers), so images are
// addressed by a stable key — row-text fingerprint + cell — and resolved here:
//   edge cache → R2 copy → current token (cached token map, else re-read the
//   sheet's htmlview) → fetch from Google, store in R2.
// The key changes whenever its row's text does, so an R2 copy is never served
// for a different image; copies are still refreshed after R2_MAX_AGE in case the
// image itself was swapped in place.

const BROWSER_TTL = 24 * 60 * 60;
const R2_MAX_AGE = 24 * 60 * 60 * 1000;

const imageResponse = (body: ReadableStream | ArrayBuffer | null, type: string) => new Response(body, {
  headers: {
    'Content-Type': type,
    'Cache-Control': `public, max-age=${BROWSER_TTL}`,
    'Access-Control-Allow-Origin': '*',
  },
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const sheetId = url.searchParams.get('s') ?? '';
  const gid = url.searchParams.get('g') ?? '';
  const key = url.searchParams.get('k') ?? '';
  const width = Math.min(Math.max(parseInt(url.searchParams.get('w') ?? '800', 10) || 800, 64), 2000);
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(sheetId) || !/^\d{1,12}$/.test(gid) || !/^[0-9a-f]{16}-\d{1,3}$/.test(key)) {
    return new Response('Bad image reference', { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://sheet-image.cache/img/${sheetId}/${gid}/${key}/${width}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const bucket = context.env.YEDITS_BUCKET;
  const r2Key = `sheet-images/${sheetId}/${gid}/${key}-w${width}`;
  const stored = bucket ? await bucket.get(r2Key) : null;
  const storedAt = Number(stored?.customMetadata?.storedAt ?? 0);
  if (stored && Date.now() - storedAt < R2_MAX_AGE) {
    const res = imageResponse(stored.body, stored.httpMetadata?.contentType ?? 'image/jpeg');
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  }

  let image: ArrayBuffer | null = null;
  let type = '';
  try {
    const token = (await getSheetImageTokens(sheetId, gid))[key];
    if (token) {
      const upstream = await fetch(`https://docs.google.com/sheets-images-rt/${token}=w${width}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
      });
      type = upstream.headers.get('content-type') ?? '';
      if (upstream.ok && type.startsWith('image/')) image = await upstream.arrayBuffer();
    }
  } catch {
    // fall through to a stale R2 copy, if any
  }

  if (!image) {
    // Row edited since the page loaded (key gone) or Google hiccup: an older
    // copy beats a broken image.
    if (stored) return imageResponse(stored.body, stored.httpMetadata?.contentType ?? 'image/jpeg');
    return new Response('Image unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  }

  if (bucket) {
    context.waitUntil(bucket.put(r2Key, image, {
      httpMetadata: { contentType: type },
      customMetadata: { storedAt: String(Date.now()) },
    }));
  }
  const res = imageResponse(image, type);
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
