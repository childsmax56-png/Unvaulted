import { json, options } from '../_auth';
import { requireModerator } from './_admin';
import { resolveTrackerCsv } from '../[artist]/_sheets';
import { splitCSVRows } from '../[artist]/_csvParser';
import { ARTIST_REGISTRY } from '../../../src/artists/registry';

// GET /api/admin/health?tracker=<slug> — data health for one official tracker:
//   - per tab: which source served it (live sheet / Sheets API / committed
//     snapshot / nothing), why a configured live source fell back, row count
//   - eras: configured eras with zero songs (the empty "0 songs" cards)
//   - row-count change vs. the snapshot from ~a week ago
// The dashboard calls this once per tracker. One snapshot per tracker per day
// is saved to D1 so week-over-week drops (a tab losing rows) stand out.
const TABS = [
  'unreleased', 'released', 'recent', 'stems', 'art', 'misc', 'music-videos',
  'fakes', 'tracklists', 'album-copies', 'individual', 'individual-tracklists',
];
const DAY_MS = 86_400_000;

export const onRequestOptions: PagesFunction = async () => options();

async function ensureHealthTable(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS tracker_health_snapshots (
      tracker TEXT NOT NULL,
      day INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (tracker, day)
    )`
  ).run();
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const gate = await requireModerator(request, env);
  if ('error' in gate) return gate.error;

  const url = new URL(request.url);
  const tracker = (url.searchParams.get('tracker') || '').toLowerCase();
  const config = ARTIST_REGISTRY[tracker];
  if (!config) return json({ error: 'Unknown tracker' }, 404);

  const tabs = await Promise.all(TABS.map(async (tab) => {
    let r = await resolveTrackerCsv(url.origin, tracker, tab, env);
    // Same fallback as /api/{slug}/a: some trackers (e.g. dregold) only commit
    // unreleased-main.csv, not unreleased.csv.
    if (tab === 'unreleased' && !r.text) {
      const main = await resolveTrackerCsv(url.origin, tracker, 'unreleased-main', env);
      if (main.text) r = { ...main, liveConfigured: r.liveConfigured, liveError: r.liveError };
    }
    const rows = r.text
      ? Math.max(0, splitCSVRows(r.text).filter(row => row.some(c => c.trim() !== '')).length - 1)
      : 0;
    return { tab, source: r.source, rows, liveConfigured: r.liveConfigured, liveError: r.liveError ?? null };
  }));

  // Era-level check from the built era data the site actually renders.
  let songs = 0;
  const songsPerEra: Record<string, number> = {};
  let erasError: string | null = null;
  try {
    const res = await fetch(`${url.origin}/api/${tracker}/a`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { eras?: Record<string, { name: string; data?: Record<string, unknown[]> }> };
    for (const era of Object.values(data.eras ?? {})) {
      const n = Object.values(era.data ?? {}).reduce((sum, b) => sum + (Array.isArray(b) ? b.length : 0), 0);
      songsPerEra[era.name] = n;
      songs += n;
    }
  } catch (err) {
    erasError = `Era data failed to build: ${err instanceof Error ? err.message : String(err)}`;
  }
  const skip = new Set([...(config.EXCLUDED_ALBUMS ?? []), ...(config.ART_ONLY_ALBUMS ?? [])]);
  const emptyEras = erasError ? [] : Object.keys(config.ALBUM_RELEASE_DATES)
    .filter(name => !skip.has(name) && !songsPerEra[name]);

  const snapshot = { tabs: Object.fromEntries(tabs.map(t => [t.tab, t.rows])), songs, eras: Object.keys(songsPerEra).length };

  // Save today's snapshot; compare against the newest one that's 6+ days old.
  let previous: { day: number; data: typeof snapshot } | null = null;
  try {
    await ensureHealthTable(env.DB);
    const today = Math.floor(Date.now() / DAY_MS);
    await env.DB.prepare(
      `INSERT OR REPLACE INTO tracker_health_snapshots (tracker, day, data) VALUES (?, ?, ?)`
    ).bind(tracker, today, JSON.stringify(snapshot)).run();
    const prev = await env.DB.prepare(
      `SELECT day, data FROM tracker_health_snapshots WHERE tracker = ? AND day <= ? ORDER BY day DESC LIMIT 1`
    ).bind(tracker, today - 6).first<{ day: number; data: string }>();
    if (prev) previous = { day: prev.day, data: JSON.parse(prev.data) };
  } catch {
    // snapshots are best-effort; the live report still returns
  }

  const issues: { level: 'error' | 'warn' | 'info'; message: string }[] = [];
  const unreleased = tabs.find(t => t.tab === 'unreleased')!;
  if (!unreleased.source || unreleased.rows === 0) issues.push({ level: 'error', message: 'Unreleased tab has no data' });
  if (erasError) issues.push({ level: 'error', message: erasError });
  else if (songs === 0) issues.push({ level: 'error', message: 'Era data built 0 songs — the site shows this tracker as empty' });
  for (const t of tabs) {
    if (t.liveConfigured && t.source === 'committed') issues.push({ level: 'warn', message: `${t.tab}: live sheet failed, serving committed snapshot (${t.liveError})` });
    if (t.liveConfigured && !t.source) issues.push({ level: 'error', message: `${t.tab}: live sheet failed and no committed snapshot (${t.liveError})` });
    const before = previous?.data.tabs[t.tab];
    if (before && before >= 20 && t.rows < before * 0.8) {
      issues.push({ level: 'warn', message: `${t.tab}: rows dropped ${before} → ${t.rows} since last week` });
    }
  }
  if (emptyEras.length) issues.push({ level: 'warn', message: `${emptyEras.length} configured era(s) have 0 songs: ${emptyEras.join(', ')}` });

  return json({ tracker, tabs, songs, eraCount: Object.keys(songsPerEra).length, emptyEras, previous, issues });
};
