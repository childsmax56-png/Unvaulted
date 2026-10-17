import { getLiveTabRef } from './_sheets';
import { fetchSheetRowImages } from './_htmlview';
import { mapEraName } from './_eraNames';

// GET /api/{slug}/era-meta — era covers + descriptions read live from the
// tracker's Unreleased tab.
//
// Era-header rows carry the cover as an in-cell image, which neither the CSV
// export nor the Sheets API returns, so this reads the sheet's htmlview (see
// _htmlview.ts). That page is several MB for big trackers, so it's kept off the
// a.ts critical path: the client loads the eras first, then fetches this and
// swaps the live covers in. Edge-cached for CACHE_TTL.
//
// Response: { eras: { [eraName]: { image?, description? } } } — empty for
// trackers without a live sheet.

const CACHE_TTL = 15 * 60;
// Bump when the response shape/parsing changes so stale edge entries are skipped.
const CACHE_VERSION = 3;

const json = (data: unknown, maxAge: number) => new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': `public, max-age=${maxAge}`,
  },
});

// Counts cell on an era header ("12 OG File(s)\n40 Full\n...") or a stats row.
const isCountsText = (s: string) => /^\d+\s/.test(s);

export const onRequestGet: PagesFunction = async (context) => {
  const artist = (context.params as Record<string, string>).artist;
  const ref = getLiveTabRef(artist, 'unreleased');
  if (!ref) return json({ eras: {} }, CACHE_TTL);

  const cache = caches.default;
  const cacheKey = new Request(new URL(context.request.url).origin + `/api/${artist}/era-meta?v=${CACHE_VERSION}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let rows;
  try {
    rows = await fetchSheetRowImages(ref.sheetId, ref.gid, { withText: true, width: 800 });
  } catch (err) {
    // Short browser cache so a Google hiccup doesn't stick; the client keeps
    // the bundled covers.
    return json({ eras: {}, error: err instanceof Error ? err.message : String(err) }, 60);
  }

  const eras: Record<string, { image?: string; description?: string }> = {};
  const rowNums = [...rows.keys()].sort((a, b) => a - b);
  rowNums.forEach((n, i) => {
    const row = rows.get(n)!;
    const cells = row.cells ?? [];
    // Era header rows: a file-counts cell up front plus the era cover.
    const countsAt = cells.findIndex(c => c.includes('\n') && isCountsText(c));
    if (countsAt === -1 || countsAt > 2 || !row.images.length) return;
    const nameAt = countsAt + 1;
    let name = (cells[nameAt] ?? '').split('\n')[0].replace(/[ \t]{2,}/g, ' ').trim();
    // Some sheets (drizzygold) use a title image as the era name — take the name
    // from the Era column of the first song row below instead.
    if (!name) {
      for (const m of rowNums.slice(i + 1, i + 6)) {
        const first = (rows.get(m)!.cells ?? [])[countsAt] ?? '';
        if (first && !first.includes('\n') && !isCountsText(first)) { name = first.replace(/[ \t]{2,}/g, ' ').trim(); break; }
      }
    }
    if (!name) return;
    // The cover is the first image outside the name cell (which may hold a title logo).
    const coverIdx = row.imageCells.findIndex(c => c !== nameAt);
    const image = row.images[coverIdx === -1 ? 0 : coverIdx];
    const description = cells
      .filter((c, ci) => ci !== nameAt && c.length >= 60 && !/^https?:\/\//i.test(c) && !isCountsText(c) && !/^\(\d/.test(c))
      .sort((a, b) => b.length - a.length)[0];
    const key = mapEraName(name);
    if (!eras[key]) eras[key] = { image, description };
  });

  const res = json({ eras }, CACHE_TTL);
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
