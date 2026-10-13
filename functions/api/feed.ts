// Cross-artist "Recently Leaked" feed.
//
// Aggregates every tracker's built era data (via the existing /api/:artist/a
// endpoint, so all the CSV parsing / era-naming logic is reused) and returns a
// flat, date-sorted list of the most recently leaked tracks across all artists.
//
// The client (LandingPage → WhatsNewFeed) joins each item's `slug` against
// ARTIST_REGISTRY for display info (name, accent, logo) and to build the
// per-era deep link, so this endpoint stays lean and config-agnostic.

// Slugs to aggregate. Kept in sync with src/artists/registry.ts.
const ARTIST_SLUGS = [
  'yegold', 'vampgold', 'wolfgold', 'drizzygold', 'xgold', 'cactigold',
  'kdotgold', 'uzigold', 'pushagold', 'shadygold', 'twizzygold', 'dregold',
  'juicegold', 'luckigold',
];

const MAX_ITEMS = 150;
// Cap per artist so one prolific tracker (e.g. yegold) can't flood the feed —
// this is a *cross-artist* feed, so diversity matters more than raw recency.
const PER_ARTIST_CAP = 25;
// Reject leak dates in the future (CSV typos like "Apr 20, 2029"), with a small
// tolerance for timezone slop.
const FUTURE_TOLERANCE_MS = 2 * 86_400_000;

interface FeedItem {
  slug: string;
  era: string;
  name: string;
  extra?: string;
  leak_date: string;
  leak_ts: number;
  quality: string;
  url: string;
}

// Parse a tracker leak date like "Apr 22, 2009" / "Jan 2019" into a timestamp.
// Rejects placeholder/partial dates ("??? ??, 2017", "Dec ??, 2013", "N/A").
function parseLeakDate(raw: string): number | null {
  const s = (raw ?? '').trim();
  if (!s || s.includes('?')) return null;
  // Must contain a plausible 4-digit year so we don't accept junk.
  const yearMatch = s.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);
  if (year < 1990 || year > 2100) return null;
  const ts = Date.parse(s);
  if (Number.isNaN(ts)) return null;
  if (ts > Date.now() + FUTURE_TOLERANCE_MS) return null;
  return ts;
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Serve from the edge cache when possible — this fans out to ~14 sub-requests.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(`${url.origin}/api/feed`, context.request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(
    ARTIST_SLUGS.map(async (slug): Promise<FeedItem[]> => {
      try {
        const res = await fetch(`${url.origin}/api/${slug}/a`);
        if (!res.ok) return [];
        const data = await res.json() as { eras?: Record<string, any> };
        const eras = data.eras ?? {};
        const items: FeedItem[] = [];
        for (const era of Object.values(eras)) {
          const buckets = (era && era.data) ? Object.values(era.data) : [];
          for (const bucket of buckets) {
            if (!Array.isArray(bucket)) continue;
            for (const song of bucket) {
              const leak_ts = parseLeakDate(song.leak_date);
              if (leak_ts === null) continue;
              const name = (song.name ?? '').trim();
              if (!name) continue;
              items.push({
                slug,
                era: era.name,
                name,
                extra: song.extra || undefined,
                leak_date: song.leak_date.trim(),
                leak_ts,
                quality: song.quality ?? '',
                url: song.url ?? '',
              });
            }
          }
        }
        // Keep only this artist's most-recent items so the global feed stays diverse.
        items.sort((a, b) => b.leak_ts - a.leak_ts);
        return items.slice(0, PER_ARTIST_CAP);
      } catch {
        return [];
      }
    })
  );

  const items = results
    .flat()
    .sort((a, b) => b.leak_ts - a.leak_ts)
    .slice(0, MAX_ITEMS);

  const body = JSON.stringify({ items, generated_at: Date.now() });
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Cache at the edge for 10 min; allow stale serving while revalidating.
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
