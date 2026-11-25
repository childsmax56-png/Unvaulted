// The Tracklists tab's { legend, albums } JSON, read live from the tracker's
// sheet (see _liveTracklists.ts) with the committed public/<slug>/Tracklists.json
// as the fallback. Edge-cached for 5 minutes so the sheet isn't re-read on
// every page view.

import { buildLiveTracklists, hasLiveTracklists, type Album } from './_liveTracklists';
import { fetchSheetRowImages } from './_htmlview';

const TTL = 300;

function json(body: string, source: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=${TTL}`,
      'X-Tracklists-Source': source,
    },
  });
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const artist = (context.params as Record<string, string>).artist ?? '';
  const cacheKey = new Request(`${url.origin}/api/${artist}/tracklists-live`);
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // The SPA catch-all serves index.html (200) for missing static files.
  let snapshotText: string | null = null;
  const loadSnapshot = async (): Promise<string | null> => {
    if (snapshotText !== null) return snapshotText;
    try {
      const res = await fetch(`${url.origin}/${artist}/Tracklists.json`);
      const text = res.ok ? await res.text() : '';
      snapshotText = text && !text.trimStart().startsWith('<') ? text : '';
    } catch {
      snapshotText = '';
    }
    return snapshotText || null;
  };

  let res: Response | null = null;
  if (hasLiveTracklists(artist)) {
    try {
      const live = await buildLiveTracklists(
        artist,
        async (sheetId, gid) => {
          const rows = await fetchSheetRowImages(sheetId, gid, { width: 1500 });
          return new Map([...rows].map(([n, r]) => [n, r.images]));
        },
        async () => {
          const text = await loadSnapshot();
          if (!text) return [];
          const raw = JSON.parse(text);
          return (Array.isArray(raw) ? raw : raw?.albums ?? []) as Album[];
        },
      );
      res = json(JSON.stringify(live), 'live');
    } catch {
      // fall through to the snapshot
    }
  }
  if (!res) {
    const text = await loadSnapshot();
    res = json(text ?? JSON.stringify({ legend: [], albums: [] }), text ? 'committed' : 'none');
  }
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
