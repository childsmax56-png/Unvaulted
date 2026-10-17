import axios from 'axios';
import { activeConfig } from './artists/activeConfig';

// Live era metadata from the tracker's Google Sheet, layered over the bundled
// artist config (src/artists/<slug>.ts):
//
//  - eras: an era the sheet has (a real header row) but the config doesn't list
//    is registered in ALBUM_RELEASE_DATES / ALBUM_ORDER, so new eras appear
//    without a config edit. Placed right after the era it follows in the sheet.
//  - descriptions: a.ts reads each era header row's description paragraph.
//  - artwork: /api/{slug}/era-meta reads the era covers (in-cell images) from the
//    sheet's htmlview — fetched after the eras render, since that page is big.
//
// The config is copied-on-write (never mutated in place) because activeConfig
// shares its objects with ARTIST_REGISTRY, which other pages read.

type ErasMap = Record<string, {
  name: string; fileInfo?: string[]; description?: string; image?: string; data?: Record<string, unknown[]>;
}>;

// Only auto-register eras that look like real sheet eras: a header row with a
// file-counts block ("12 OG File(s)", "40 Full", ...), a title-like name (not a
// footer sentence or a ⭐-tagged song row a.ts picked up), and at least one song.
// Header-name variants of a configured era (songs filed under the config's
// spelling) come through with no songs and are skipped.
function isRealSheetEra(era: ErasMap[string]): boolean {
  const counts = (era.fileInfo ?? []).filter(l => /^\d+\s+\S/.test(l)).length;
  if (counts < 2) return false;
  const name = era.name.trim();
  if (!name || name.length > 80 || /[.!?]$/.test(name) || /^[^\p{L}\p{N}(["'$]/u.test(name)) return false;
  return Object.values(era.data ?? {}).some(list => Array.isArray(list) && list.length > 0);
}

const normKey = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

export function applyLiveEras(eras: ErasMap | undefined): void {
  if (!eras) return;
  const skip = new Set([
    ...(activeConfig.HIDDEN_ALBUMS ?? []),
    ...(activeConfig.EXCLUDED_ALBUMS ?? []),
    'Recent Leaks',
  ]);

  const dates = { ...activeConfig.ALBUM_RELEASE_DATES };
  const order = [...(activeConfig.ALBUM_ORDER ?? Object.keys(dates))];
  const known = new Set(Object.keys(dates).map(normKey));
  let added = false;
  let prev: string | null = null;

  for (const era of Object.values(eras)) {
    const name = era.name;
    if (name in dates) { prev = name; continue; }
    if (!isRealSheetEra(era) || skip.has(name) || known.has(normKey(name))) continue;
    dates[name] = '';
    const at = prev ? order.indexOf(prev) + 1 : order.length;
    order.splice(at > 0 ? at : order.length, 0, name);
    known.add(normKey(name));
    prev = name;
    added = true;
  }
  if (added) {
    activeConfig.ALBUM_RELEASE_DATES = dates;
    activeConfig.ALBUM_ORDER = order;
  }

  const descriptions = Object.values(eras).filter(e => e.description?.trim());
  if (descriptions.length) {
    activeConfig.ALBUM_DESCRIPTIONS = {
      ...activeConfig.ALBUM_DESCRIPTIONS,
      ...Object.fromEntries(descriptions.map(e => [e.name, e.description!.trim()])),
    };
  }
}

interface EraMeta { image?: string; description?: string }

// Fetch live era covers (+ descriptions for trackers whose a.ts CSV doesn't carry
// them) and merge into the config. Resolves true when anything changed, so the
// caller can re-render. Era names are matched loosely against the loaded eras.
export async function loadLiveEraArtwork(slug: string, eras: ErasMap | undefined): Promise<boolean> {
  let meta: Record<string, EraMeta>;
  try {
    const res = await axios.get(`/api/${slug}/era-meta`, { timeout: 30000 });
    meta = res.data?.eras ?? {};
  } catch {
    return false;
  }
  if (activeConfig.slug !== slug || !eras) return false; // navigated away

  const mappings = activeConfig.ERA_MAPPINGS ?? {};
  const byNorm = new Map(Object.keys(eras).map(n => [normKey(n), n]));
  const resolve = (raw: string): string | undefined => {
    if (eras[raw]) return raw;
    const mapKey = Object.keys(mappings).find(k => k.toLowerCase() === raw.toLowerCase());
    if (mapKey && eras[mappings[mapKey]]) return mappings[mapKey];
    return byNorm.get(normKey(raw));
  };

  const images: Record<string, string> = {};
  const descriptions: Record<string, string> = {};
  for (const [raw, m] of Object.entries(meta)) {
    const name = resolve(raw);
    if (!name) continue;
    if (m.image) images[name] = m.image;
    if (m.description && !eras[name].description) descriptions[name] = m.description;
  }
  if (!Object.keys(images).length && !Object.keys(descriptions).length) return false;

  activeConfig.CUSTOM_IMAGES = { ...activeConfig.CUSTOM_IMAGES, ...images };
  if (Object.keys(descriptions).length) {
    activeConfig.ALBUM_DESCRIPTIONS = { ...activeConfig.ALBUM_DESCRIPTIONS, ...descriptions };
  }
  return true;
}
