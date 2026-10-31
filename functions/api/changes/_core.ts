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
// Each tracker costs ~10 catalog fetches (main + every side tab) plus R2 reads
// and writes, so shards stay small to fit the per-invocation subrequest limit.
export const SHARD_SIZE = 3;
export const SHARD_COUNT = Math.ceil(SCAN_SLUGS.length / SHARD_SIZE);
// A shard counts as overdue (for opportunistic scans) after this long.
export const SCAN_INTERVAL_MS = 20 * 60_000;

const SNAPSHOT_PREFIX = 'tracker-changes/v1/';

// Side tabs scanned alongside the main (Unreleased) catalog. The id is the
// tracker route segment the client links to (/{slug}/{id}); the path is the
// /api/{slug}/{path} endpoint. Recent / Best Of are skipped — they're views of
// the main catalog, so they'd only duplicate its changes. A tracker without a
// tab just 404s that endpoint and is skipped.
export const SIDE_TABS = [
  { id: 'released', path: 'released', label: 'Released' },
  { id: 'stems', path: 'stems', label: 'Stems' },
  { id: 'art', path: 'art', label: 'Art' },
  { id: 'videos', path: 'music-videos', label: 'Videos' },
  { id: 'fakes', path: 'fakes', label: 'Fakes' },
  { id: 'misc', path: 'misc', label: 'Misc' },
  { id: 'tracklists', path: 'tracklists', label: 'Tracklists' },
  { id: 'albumcopies', path: 'album-copies', label: 'Album Copies' },
  { id: 'groupbuys', path: 'groupbuys', label: 'Groupbuys' },
] as const;
export const TAB_LABELS: Record<string, string> = Object.fromEntries(SIDE_TABS.map((t) => [t.id, t.label]));

export type ChangeKind =
  | 'added' | 'removed' | 'renamed' | 'moved'
  | 'link_added' | 'link_removed' | 'link_changed'
  | 'availability' | 'quality' | 'resync';

export interface ChangeRow {
  id: string;
  slug: string;
  tab: string; // '' = main Unreleased catalog, else a SIDE_TABS id
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
// All side tabs of one tracker share a single R2 object (fewer subrequests).
interface TabsSnapshot { at: number; tabs: Record<string, SnapSong[]> }

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
    // Per-tracker override of whether alerts also go out as push + Discord
    // (external = 1) or stay in the in-app inbox only (external = 0).
    // Trackers without a row follow alert_settings.external_default.
    db.prepare(
      `CREATE TABLE IF NOT EXISTS alert_tracker_delivery (
        user_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        external INTEGER NOT NULL,
        PRIMARY KEY (user_id, slug)
      )`
    ),
  ]);
  // Added after alert_settings shipped; ADD COLUMN throws once it exists.
  await db.prepare('ALTER TABLE alert_settings ADD COLUMN external_default INTEGER NOT NULL DEFAULT 1').run().catch(() => {});
  // Optional per-tracker Discord webhook; replaces the account-wide one for that tracker.
  await db.prepare('ALTER TABLE alert_tracker_delivery ADD COLUMN discord_webhook TEXT').run().catch(() => {});
  // Which tab a change came from ('' = main catalog); added when side tabs got scanned.
  await db.prepare("ALTER TABLE tracker_changes ADD COLUMN tab TEXT NOT NULL DEFAULT ''").run().catch(() => {});
  ensured = true;
}

// ---- Snapshot building -----------------------------------------------------

// Link cells often hold placeholder text ("N/A", "Snippet", "Unavailable");
// only an actual URL counts as a link (same idea as looksLikeRealLink in src/utils.tsx).
function realLink(raw: unknown): string {
  const s = String(raw ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : '';
}

// Side-tab link cells can hold several links, and Art cells point at our own
// /api/sheet-image proxy; take the first real one.
function firstLink(raw: unknown): string {
  for (const part of String(raw ?? '').split(/\s+/)) {
    if (/^https?:\/\/\S+$/i.test(part) || part.startsWith('/api/')) return part;
  }
  return '';
}

// Case-insensitive column lookup for the CSV-row tab endpoints (headers vary
// per tracker: "Link(s)" / "Links", "Available Length" / "Avail. Length" …).
function col(row: Record<string, unknown>, ...names: string[]): string {
  for (const want of names) {
    for (const k of Object.keys(row)) {
      if (k.replace(/\s+/g, ' ').trim().toLowerCase() === want) return String(row[k] ?? '').trim();
    }
  }
  return '';
}

async function fetchTab(origin: string, slug: string, path: string): Promise<SnapSong[] | null> {
  const res = await fetch(`${origin}/api/${slug}/${path}`, { cache: 'no-store' } as RequestInit);
  if (!res.ok) return null;
  const data = await res.json() as any;
  const songs: SnapSong[] = [];
  if (path === 'album-copies') {
    for (const era of data?.eras ?? []) {
      for (const c of era?.copies ?? []) {
        const name = String(c?.name ?? '').trim();
        if (name) songs.push([String(era.name ?? ''), name, '', firstLink(c.url), String(c.quality ?? '').trim(), String(c.available_length ?? '').trim()]);
      }
    }
  } else if (path === 'groupbuys') {
    // quality ← price, availability ← status (funded / ongoing …)
    for (const y of data?.years ?? []) {
      for (const b of y?.buys ?? []) {
        const name = String(b?.name ?? '').trim();
        if (name) songs.push([String(b.era ?? ''), name, String(b.start ?? '').trim(), firstLink(b.link), String(b.price ?? '').trim(), String(b.status ?? '').trim()]);
      }
    }
  } else if (Array.isArray(data)) {
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      // Rows without an era or a name are era headers / legends, not entries.
      const era = col(row, 'era');
      const [name, ...rest] = col(row, 'name').split('\n').map((l) => l.trim()).filter(Boolean);
      if (!era || !name) continue;
      songs.push([
        era,
        name,
        rest.join(' '),
        firstLink(col(row, 'link(s)', 'links', 'link')),
        col(row, 'quality'),
        col(row, 'available length', 'avail. length', 'streaming', 'status'),
      ]);
    }
  } else {
    return null;
  }
  return songs;
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

type Pending = Omit<ChangeRow, 'id' | 'slug' | 'tab' | 'detected_at'>;

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

// Diff one catalog list against its previous snapshot. `save` = whether the
// new list should replace the stored one.
function diffList(prev: SnapSong[] | undefined, songs: SnapSong[]): { status: string; pending: Pending[]; save: boolean } {
  // First sight: baseline only, never a flood of "added".
  if (!prev) return { status: 'baseline', pending: [], save: true };
  // A catalog that suddenly lost half its songs is almost always a live-sheet
  // hiccup (fallback CSV, tab restructure mid-edit) — skip and keep the old
  // snapshot rather than reporting mass removals.
  if (songs.length < prev.length * 0.5) return { status: 'shrunk_skipped', pending: [], save: false };
  const pending = diffSnapshots(prev, songs);
  if (pending.length === 0) return { status: 'unchanged', pending, save: true };
  // Huge diffs mean the tracker was restructured (eras renamed, columns
  // shifted). Record a single marker instead of hundreds of bogus entries.
  if (pending.length > Math.max(80, Math.min(400, prev.length * 0.15))) {
    return {
      status: 'resync',
      pending: [{ era: '', name: '', norm_name: '', kind: 'resync', old_value: String(prev.length), new_value: String(songs.length), url: null }],
      save: true,
    };
  }
  return { status: 'changed', pending, save: true };
}

// Scan one tracker — its main catalog and every side tab. Returns the change
// rows written (already inserted).
export async function scanSlug(env: Env, origin: string, slug: string, now: number): Promise<{ result: ScanResult; rows: ChangeRow[] }> {
  const mainKey = `${SNAPSHOT_PREFIX}${slug}.json`;
  const tabsKey = `${SNAPSHOT_PREFIX}${slug}.tabs.json`;
  const safe = <T>(p: Promise<T>) => p.catch(() => null);
  const [songs, tabLists, prevMainObj, prevTabsObj] = await Promise.all([
    safe(fetchCatalog(origin, slug)),
    Promise.all(SIDE_TABS.map((t) => safe(fetchTab(origin, slug, t.path)))),
    env.YEDITS_BUCKET.get(mainKey),
    env.YEDITS_BUCKET.get(tabsKey),
  ]);

  const pending: (Pending & { tab: string })[] = [];
  const statuses: string[] = [];
  const writes: (() => Promise<unknown>)[] = [];
  const put = (key: string, body: unknown) =>
    writes.push(() => env.YEDITS_BUCKET.put(key, JSON.stringify(body), { httpMetadata: { contentType: 'application/json' } }));

  if (songs && songs.length) {
    const prev = prevMainObj ? ((await prevMainObj.json()) as Snapshot).songs : undefined;
    const d = diffList(prev, songs);
    statuses.push(d.status);
    pending.push(...d.pending.map((p) => ({ ...p, tab: '' })));
    if (d.save) put(mainKey, { at: now, songs } satisfies Snapshot);
  } else {
    statuses.push('fetch_failed');
  }

  const prevTabs = prevTabsObj ? ((await prevTabsObj.json()) as TabsSnapshot).tabs : {};
  // Tabs that failed to load this time keep their old snapshot.
  const nextTabs: Record<string, SnapSong[]> = { ...prevTabs };
  SIDE_TABS.forEach((t, i) => {
    const list = tabLists[i];
    if (!list || list.length === 0) return;
    const d = diffList(prevTabs[t.id], list);
    if (d.status !== 'unchanged' && d.status !== 'baseline') statuses.push(`${t.id}:${d.status}`);
    pending.push(...d.pending.map((p) => ({ ...p, tab: t.id })));
    if (d.save) nextTabs[t.id] = list;
  });
  put(tabsKey, { at: now, tabs: nextTabs } satisfies TabsSnapshot);

  const rows: ChangeRow[] = pending.map((p, i) => ({ ...p, id: crypto.randomUUID(), slug, detected_at: now + i }));
  const stmt = env.DB.prepare(
    `INSERT INTO tracker_changes (id, slug, tab, era, name, norm_name, kind, old_value, new_value, url, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (let i = 0; i < rows.length; i += 50) {
    await env.DB.batch(rows.slice(i, i + 50).map((r) =>
      stmt.bind(r.id, r.slug, r.tab, r.era, r.name, r.norm_name, r.kind, r.old_value, r.new_value, r.url, r.detected_at)
    ));
  }
  // Snapshots are written only after the rows are in, so a failed insert
  // re-detects the same changes next scan instead of losing them.
  await Promise.all(writes.map((w) => w()));
  return { result: { slug, status: statuses.join(' '), changes: rows.length }, rows };
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
