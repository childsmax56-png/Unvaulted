import { parseCSV, csvResponse } from './_csvParser';
import { fetchTrackerCsv } from './_sheets';

const VALID_TYPES = new Set(['Feature', 'Production', 'Single', 'Album Track', 'Mixtape Track', 'EP Track', 'Other']);

// Some sheets (e.g. chrisbrowngold) use compound or extra type labels that aren't in
// VALID_TYPES verbatim (a strict allowlist match would silently drop these rows
// entirely). Normalize known variants to their closest VALID_TYPES value.
function normalizeType(raw: string): string {
  const t = raw.trim();
  if (VALID_TYPES.has(t)) return t;
  const stripped = t.replace(/^International\s+/i, '');
  if (VALID_TYPES.has(stripped)) return stripped;
  if (/^Single\s*\//.test(t)) return 'Single';
  if (/Bonus Track$/i.test(stripped)) return 'Other';
  if (/^(Interlude|Intro|Outro)$/i.test(stripped)) return 'Other';
  return t;
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const artist = (context.params as Record<string, string>).artist ?? "yzygold";

  const text = await fetchTrackerCsv(url.origin, artist, 'released', context.env as Env, context.request);
  if (text === null) return new Response('CSV not found', { status: 404 });

  // jayzgold's sheet uses "Album" instead of "Era", and mislabels its Type column
  // header as "Release Date" (keeping the real release date in a separate "Date"
  // column) instead of the usual "Era" / "Release Date" / "Type" naming every other
  // tracker uses — remap them back when the standard columns are missing so era
  // grouping, the type badge, and the date all show the right values.
  const rows = parseCSV(text).map(row => {
    let out = row;
    if (out['Era'] === undefined && out['Album'] !== undefined) {
      out = { ...out, Era: out['Album'] };
    }
    if (out['Type'] === undefined && out['Release Date'] !== undefined && out['Date'] !== undefined) {
      out = { ...out, Type: out['Release Date'], 'Release Date': out['Date'] };
    }
    return out;
  });
  const filtered = rows
    .map(row => ({ ...row, Type: normalizeType(row['Type'] || '') }))
    .filter(row => VALID_TYPES.has(row['Type']));

  return csvResponse(filtered);
};
