import { parseCSV, csvResponse } from './_csvParser';
import { fetchTrackerCsv } from './_sheets';

// Tracklists for the "Individual Projects" tab (see individual.ts) — same raw-row
// passthrough as tracklists.ts, just a different sheet tab. Grouping into albums
// happens client-side in TracklistsView.
export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const artist = (context.params as Record<string, string>).artist ?? 'wutanggold';

  const text = await fetchTrackerCsv(url.origin, artist, 'individual-tracklists', context.env as Env, context.request);
  if (text === null) return new Response('CSV not found', { status: 404 });

  const rows = parseCSV(text);

  return csvResponse(rows);
};
