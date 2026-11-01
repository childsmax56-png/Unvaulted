// Resolves an ibb.co/<id> *page* URL to its direct i.ibb.co/<hash>/<file>
// image URL. Most cover-art links in the data are stored as ibb.co page
// links, not direct images, so an <img src> pointed at them never loads.
//
// The gallery previously resolved these only via a single free third-party
// API (imgbb-file-get-api.vercel.app). When that host is slow, rate-limited,
// or down, every uncached image "struggles to load". This same-origin
// function does the resolution itself (parsing the og:image the ibb.co page
// exposes) and caches the answer at Cloudflare's edge, so repeat resolves
// across all visitors are served instantly instead of hammering a flaky
// external API on every view.
//
// Also resolves imgur links the same way: imgur.com/<id>, /a/<album> and
// /gallery/<post> pages expose their (first) image as og:image, and imgur.gg/f/<id>
// file pages resolve through imgur.gg's file API (images only — it also hosts
// video/zips, which can't render as art).
//
// Wrapped in try/catch so an upstream fetch failure returns a useful JSON
// error instead of Cloudflare's generic edge error page.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
  });
}

// Pull the direct i.ibb.co image URL out of an ibb.co page's HTML. imgbb
// exposes it as the og:image meta tag; the other patterns are belt-and-braces
// fallbacks in case the markup shifts.
function extractDirectLink(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /https?:\/\/i\.ibb\.co\/[A-Za-z0-9]+\/[^"'\s\\]+/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    const found = m ? (m[1] ?? m[0]) : null;
    if (found && /^https?:\/\/i\.ibb\.co\//i.test(found)) return found;
  }
  return null;
}

// og:image on imgur pages carries a "?fb" (Facebook crop) suffix — drop the
// query so the full-size original is served.
function extractImgurLink(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const found = m?.[1];
  if (!found || !/^https?:\/\/i\.imgur\.com\//i.test(found)) return null;
  return found.split('?')[0];
}

async function resolveImgurGgFile(pageUrl: URL): Promise<string | null> {
  const id = pageUrl.pathname.split('/f/')[1]?.split('/')[0];
  if (!id) return null;
  const res = await fetch(`https://${pageUrl.host}/api/file/${id}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as { cdnUrl?: string; type?: string } | null;
  return data?.cdnUrl && String(data.type ?? '').startsWith('image/') ? data.cdnUrl : null;
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS });

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const target = url.searchParams.get('url');
    if (!target) return json({ error: 'Missing url parameter' }, 400);

    let pageUrl: URL;
    try {
      pageUrl = new URL(target);
    } catch {
      return json({ error: 'Invalid url parameter' }, 400);
    }

    const host = pageUrl.hostname.toLowerCase();
    const isIbb = host === 'ibb.co' || host.endsWith('.ibb.co');
    const isImgur = host === 'imgur.com' || host === 'www.imgur.com' || host === 'm.imgur.com' || host === 'i.imgur.com';
    const isImgurGg = (host === 'imgur.gg' || host.endsWith('.imgur.gg')) && pageUrl.pathname.startsWith('/f/');
    if (!isIbb && !isImgur && !isImgurGg) {
      return json({ error: 'Host not allowed' }, 403);
    }

    // Already a direct image URL — nothing to resolve.
    if (host === 'i.ibb.co' || host === 'i.imgur.com') {
      return json({ direct_link: pageUrl.toString() }, 200, {
        'Cache-Control': 'public, max-age=604800',
      });
    }

    // Serve a previously resolved answer straight from the edge cache.
    const cache = (caches as any).default;
    const cacheKey = new Request(`https://ibb-resolve.cache/?url=${encodeURIComponent(pageUrl.toString())}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let direct: string | null;
    if (isImgurGg) {
      direct = await resolveImgurGgFile(pageUrl);
    } else {
      const pageRes = await fetch(pageUrl.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(10000),
      });
      if (!pageRes.ok) {
        return json({ error: `Failed to fetch page (status ${pageRes.status})` }, 502);
      }
      const html = await pageRes.text();
      direct = isImgur ? extractImgurLink(html) : extractDirectLink(html);
    }
    if (!direct) return json({ error: 'No image link found' }, 502);

    // Cache resolved links aggressively — a page's direct URL is stable.
    const resp = json({ direct_link: direct }, 200, {
      'Cache-Control': 'public, max-age=604800',
    });
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (err) {
    return json({ error: `ibb-resolve error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
};
