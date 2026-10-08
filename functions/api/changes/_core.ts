// Tracker changelog + leak alerts — shared core.
//
// A scan fetches each tracker's built catalog (/api/{slug}/a, so all the CSV /
// era-building logic is reused), compares it to the previous snapshot kept in
// R2, and records what changed (new songs, links added, snippet → full, renames
// …) in D1. Matching follows then turn those changes into notifications, which
// fan out to the in-app inbox, web push and Discord webhooks (see _notify.ts).
//
// Scans are sharded like the producer index so one invocation never fetches
// more than SHARD_SIZE catalogs. They're driven by the changes-cron Worker
// (workers/changes-cron) and, as a fallback, opportunistically by page views
// of /api/changes when the stalest shard is overdue.

import { PRODUCER_SLUGS } from '../producers/_index';

// Public trackers to scan — same list the producer index uses (hidden trackers
// are deliberately excluded). Add new trackers there.
export const SCAN_SLUGS = PRODUCER_SLUGS;
export const SHARD_SIZE = 5;
export const SHARD_COUNT = Math.ceil(SCAN_SLUGS.length / SHARD_SIZE);
// A shard counts as overdue (for opportunistic scans) after this long.
export const SCAN_INTERVAL_MS = 20 * 60_000;

const SNAPSHOT_PREFIX = 'tracker-changes/v1/';

export type ChangeKind =
  | 'added' | 'removed' | 'renamed' | 'moved'
  | 'link_added' | 'link_removed' | 'link_changed'
  | 'availability' | 'quality' | 'resync';

export interface ChangeRow {
  id: string;
  slug: string;
  era: string;
  name: string;
  norm_name: string;
  kind: ChangeKind;
  old_value: string | null;
  new_value: string | null;
  url: string | null;
  detected_at: number;
}

// One catalog song as stored in a snapshot: [era, name, extra, url, quality, availability]
type SnapSong = [string, string, string, string, string, string];
interface Snapshot { at: number; songs: SnapSong[] }

export function norm(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

let ensured = false;
export async function ensureChangeTables(db: D1Database): Promise<void> {
  if (ensured) return;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS tracker_changes (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        era TEXT NOT NULL,
        name TEXT NOT NULL,
        norm_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        url TEXT,
        detected_at INTEGER NOT NULL
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracker_changes_time ON tracker_changes(detected_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tracker_changes_slug_time ON tracker_changes(slug, detected_at)`),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS tracker_scan_state (
        shard INTEGER PRIMARY KEY,
        last_scan_at INTEGER NOT NULL,
        locked_until INTEGER NOT NULL DEFAULT 0
      )`
    ),
    // scope: 'artist' (era/song_key empty) | 'era' (era = normalized era) | 'song' (song_key = normalized name)
    db.prepare(
      `CREATE TABLE IF NOT EXISTS alert_follows (
        user_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        scope TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        label TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, slug, scope, target)
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_alert_follows_slug ON alert_follows(slug)`),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS alert_notifications (
        user_id TEXT NOT NULL,
        change_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        PRIMARY KEY (user_id, change_id)
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_alert_notifications_user ON alert_notifications(user_id, created_at)`),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS alert_settings (
        user_id TEXT PRIMARY KEY,
        discord_webhook TEXT,
        updated_at INTEGER NOT NULL
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS alert_push_subs (
        endpoint TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_alert_push_user ON alert_push_subs(user_id)`),
  ]);
  ensured = true;
}

// ---- Snapshot building -----------------------------------------------------

// Link cells often hold placeholder text ("N/A", "Snippet", "Unavailable");
// only an actual URL counts as a link (same idea as looksLikeRealLink in src/utils.tsx).
function realLink(raw: unknown): string {
  const s = String(raw ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : '';
}

async function fetchCatalog(origin: string, slug: string): Promise<SnapSong[] | null> {
  // cache: 'no-store' so a scan never diffs against a stale edge copy.
  const res = await fetch(`${origin}/api/${slug}/a`, { cache: 'no-store' } as RequestInit);
  if (!res.ok) return null;
  const data = await res.json() as { eras?: Record<string, any> };
  const songs: SnapSong[] = [];
  for (const era of Object.values(data.eras ?? {})) {
    const buckets = era && era.data ? Object.values(era.data) : [];
    for (const bucket of buckets) {
      if (!Array.isArray(bucket)) continue;
      for (const s of bucket) {
        const name = String(s?.name ?? '').trim();
        if (!name) continue;
        songs.push([
          String(era.name ?? ''),
          name,
          String(s.extra ?? '').trim(),
          realLink(s.url),
          String(s.quality ?? '').trim(),
          String(s.available_length ?? '').trim(),
        ]);
      }
    }
  }
  return songs;
}

// ---- Diffing ---------------------------------------------------------------

type Pending = Omit<ChangeRow, 'id' | 'slug' | 'detected_at'>;

function change(kind: ChangeKind, s: SnapSong, oldValue: string | null, newValue: string | null): Pending {
  return { era: s[0], name: s[1], norm_name: norm(s[1]), kind, old_value: oldValue, new_value: newValue, url: s[3] || null };
}

// Field-level changes between two versions of the same song.
function compareSong(o: SnapSong, n: SnapSong, out: Pending[]) {
  const [, , , oUrl, oQ, oA] = o;
  const [, , , nUrl, nQ, nA] = n;
  if (!oUrl && nUrl) out.push(change('link_added', n, null, nUrl));
  else if (oUrl && !nUrl) out.push(change('link_removed', n, oUrl, null));
  else if (oUrl !== nUrl) out.push(change('link_changed', n, oUrl, nUrl));
  if (norm(oA) !== norm(nA) && nA) out.push(change('availability', n, oA || null, nA));
  if (norm(oQ) !== norm(nQ) && nQ) out.push(change('quality', n, oQ || null, nQ));
}

// Pair old and new songs: within each (era, name) group, first by identical
// link, then by identical extra line, then by position. Leftovers become
// added/removed — except leftovers that share a link with each other, which are
// renames (name changed) or moves (era changed).
export function diffSnapshots(prev: SnapSong[], next: SnapSong[]): Pending[] {
  const groupKey = (s: SnapSong) => `${norm(s[0])}\u0000${norm(s[1])}`;
  const group = (list: SnapSong[]) => {
    const m = new Map<string, SnapSong[]>();
    for (const s of list) {
      const k = groupKey(s);
      const arr = m.get(k);
      if (arr) arr.push(s); else m.set(k, [s]);
    }
    return m;
  };
  const oldGroups = group(prev);
  const newGroups = group(next);
  const out: Pending[] = [];
  const leftoverOld: SnapSong[] = [];
  const leftoverNew: SnapSong[] = [];

  for (const [k, news] of newGroups) {
    const olds = [...(oldGroups.get(k) ?? [])];
    const unmatchedNew: SnapSong[] = [];
    const take = (pred: (o: SnapSong) => boolean) => {
      const i = olds.findIndex(pred);
      return i === -1 ? null : olds.splice(i, 1)[0];
    };
    // Pass 1: identical link.
    for (const n of news) {
      const o = n[3] ? take((o) => o[3] === n[3]) : null;
      if (o) compareSong(o, n, out); else unmatchedNew.push(n);
    }
    // Pass 2: identical extra line; pass 3: position.
    const stillNew: SnapSong[] = [];
    for (const n of unmatchedNew) {
      const o = take((o) => norm(o[2]) === norm(n[2]));
      if (o) compareSong(o, n, out); else stillNew.push(n);
    }
    for (const n of stillNew) {
      const o = olds.shift();
      if (o) compareSong(o, n, out); else leftoverNew.push(n);
    }
    leftoverOld.push(...olds);
    oldGroups.delete(k);
  }
  for (const olds of oldGroups.values()) leftoverOld.push(...olds);

  // Renames / moves: a removed and an added song with the same (unique) link.
  const oldByUrl = new Map<string, SnapSong>();
  for (const o of leftoverOld) if (o[3]) oldByUrl.set(o[3], o);
  const consumed = new Set<SnapSong>();
  for (const n of leftoverNew) {
    const o = n[3] ? oldByUrl.get(n[3]) : undefined;
    if (o && !consumed.has(o)) {
      consumed.add(o);
      if (norm(o[1]) !== norm(n[1])) out.push(change('renamed', n, o[1], n[1]));
      else out.push(change('moved', n, o[0], n[0]));
      continue;
    }
    out.push(change('added', n, null, null));
  }
  for (const o of leftoverOld) {
    if (!consumed.has(o)) out.push(change('removed', o, null, null));
  }
  return out;
}

// ---- Scanning --------------------------------------------------------------

export interface ScanResult { slug: string; status: string; changes: number }

// Scan one tracker. Returns the change rows written (already inserted).
export async function scanSlug(env: Env, origin: string, slug: string, now: number): Promise<{ result: ScanResult; rows: ChangeRow[] }> {
  const key = `${SNAPSHOT_PREFIX}${slug}.json`;
  let songs: SnapSong[] | null;
  try {
    songs = await fetchCatalog(origin, slug);
  } catch {
    songs = null;
  }
  if (!songs || songs.length === 0) return { result: { slug, status: 'fetch_failed', changes: 0 }, rows: [] };

  const saveSnapshot = () =>
    env.YEDITS_BUCKET.put(key, JSON.stringify({ at: now, songs } satisfies Snapshot), {
      httpMetadata: { contentType: 'application/json' },
    });

  const prevObj = await env.YEDITS_BUCKET.get(key);
  if (!prevObj) {
    // First sight of this tracker: baseline only, never a flood of "added".
    await saveSnapshot();
    return { result: { slug, status: 'baseline', changes: 0 }, rows: [] };
  }
  const prev = (await prevObj.json()) as Snapshot;

  // A catalog that suddenly lost half its songs is almost always a live-sheet
  // hiccup (fallback CSV, tab restructure mid-edit) — skip and keep the old
  // snapshot rather than reporting mass removals.
  if (songs.length < prev.songs.length * 0.5) {
    return { result: { slug, status: 'shrunk_skipped', changes: 0 }, rows: [] };
  }

  const pending = diffSnapshots(prev.songs, songs);
  if (pending.length === 0) {
    await saveSnapshot();
    return { result: { slug, status: 'unchanged', changes: 0 }, rows: [] };
  }

  // Huge diffs mean the tracker was restructured (eras renamed, columns
  // shifted). Record a single marker instead of hundreds of bogus entries.
  const bulk = pending.length > Math.max(80, Math.min(400, prev.songs.length * 0.15));
  const rows: ChangeRow[] = (bulk
    ? [{ era: '', name: '', norm_name: '', kind: 'resync' as ChangeKind, old_value: String(prev.songs.length), new_value: String(songs.length), url: null }]
    : pending
  ).map((p, i) => ({ ...p, id: crypto.randomUUID(), slug, detected_at: now + i }));

  const stmt = env.DB.prepare(
    `INSERT INTO tracker_changes (id, slug, era, name, norm_name, kind, old_value, new_value, url, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (let i = 0; i < rows.length; i += 50) {
    await env.DB.batch(rows.slice(i, i + 50).map((r) =>
      stmt.bind(r.id, r.slug, r.era, r.name, r.norm_name, r.kind, r.old_value, r.new_value, r.url, r.detected_at)
    ));
  }
  await saveSnapshot();
  return { result: { slug, status: bulk ? 'resync' : 'changed', changes: rows.length }, rows };
}

// Claim a shard for scanning (a short lock so overlapping cron + page-view
// triggers don't double-scan). Returns false if someone else holds it.
export async function claimShard(db: D1Database, shard: number, now: number, force: boolean): Promise<boolean> {
  const row = await db.prepare('SELECT last_scan_at, locked_until FROM tracker_scan_state WHERE shard = ?')
    .bind(shard).first<{ last_scan_at: number; locked_until: number }>();
  if (row && row.locked_until > now) return false;
  if (!force && row && now - row.last_scan_at < SCAN_INTERVAL_MS) return false;
  const lockUntil = now + 5 * 60_000;
  if (row) {
    const res = await db.prepare('UPDATE tracker_scan_state SET locked_until = ? WHERE shard = ? AND locked_until = ?')
      .bind(lockUntil, shard, row.locked_until).run();
    return (res.meta.changes ?? 0) > 0;
  }
  const res = await db.prepare('INSERT OR IGNORE INTO tracker_scan_state (shard, last_scan_at, locked_until) VALUES (?, 0, ?)')
    .bind(shard, lockUntil).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function releaseShard(db: D1Database, shard: number, now: number): Promise<void> {
  await db.prepare('UPDATE tracker_scan_state SET last_scan_at = ?, locked_until = 0 WHERE shard = ?')
    .bind(now, shard).run();
}

// The shard that has gone longest without a scan (or a never-scanned one).
export async function stalestShard(db: D1Database): Promise<{ shard: number; lastScanAt: number }> {
  const rows = await db.prepare('SELECT shard, last_scan_at FROM tracker_scan_state').all<{ shard: number; last_scan_at: number }>();
  const seen = new Map(rows.results.map((r) => [r.shard, r.last_scan_at]));
  let best = { shard: 0, lastScanAt: Infinity };
  for (let i = 0; i < SHARD_COUNT; i++) {
    const at = seen.get(i) ?? 0;
    if (at < best.lastScanAt) best = { shard: i, lastScanAt: at };
  }
  return best;
}
