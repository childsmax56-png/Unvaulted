// Dead-link detection: schema, link normalization, and the per-host checker.
//
// Every checked catalog link gets one row in `link_status`, keyed by
// (tracker, url). Rows are written by three paths:
//   - the admin dashboard's scan (functions/api/admin/link-check.ts), which
//     walks a tracker's songs in small batches,
//   - user "report broken link" clicks (functions/api/links/report.ts), and
//   - automatic reports when the player fails to load a song's audio.
// Reports never mark a link dead on their own — they trigger a server-side
// re-check, and only a host's definitive "this file is gone" answer (404/410)
// marks it dead. Timeouts, 403s, 429s and 5xx stay 'unknown' so a flaky host
// or a down proxy can't paint a whole tracker red.
//
// Tables are created lazily (CREATE TABLE IF NOT EXISTS), matching the
// comments / listening / community features.

export type LinkVerdict = 'ok' | 'dead' | 'unknown';

export interface LinkCheckResult {
  status: LinkVerdict;
  httpStatus: number | null;
  detail?: string;
}

// Matches src/utils.tsx DEFAULT_PIXELDRAIN_PROXY_URL — keep in sync. Pixeldrain
// rejects requests from Cloudflare Workers (cf-worker header), so the check goes
// through the same non-Cloudflare proxy the player uses; the proxy forwards
// pixeldrain's own status (404 for a deleted file).
const DEFAULT_PIXELDRAIN_PROXY_URL = 'https://pdproxy-7p26sd4ehfvg.childsmax56-png.deno.net';

const CHECK_TIMEOUT_MS = 10_000;

let ensured = false;

export async function ensureLinkTables(db: D1Database): Promise<void> {
  if (ensured) return;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS link_status (
        tracker TEXT NOT NULL,
        url TEXT NOT NULL,
        era TEXT,
        name TEXT,
        status TEXT NOT NULL,
        http_status INTEGER,
        detail TEXT,
        checked_at INTEGER NOT NULL,
        dead_since INTEGER,
        override TEXT,
        PRIMARY KEY (tracker, url)
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_link_status_dead ON link_status(tracker, status)`),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS link_reports (
        id TEXT PRIMARY KEY,
        tracker TEXT NOT NULL,
        url TEXT NOT NULL,
        entry_label TEXT,
        reason TEXT NOT NULL,
        user_id TEXT,
        reporter TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_link_reports_open ON link_reports(resolved, tracker, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_link_reports_reporter ON link_reports(reporter, created_at)`),
  ]);
  ensured = true;
}

export function normTracker(raw: string): string {
  return (raw || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

// Canonical form of a catalog link so the client's row URL and the stored key
// match. Mirrors src/linkStatus.ts normalizeLinkUrl — keep in sync.
export function normalizeLinkUrl(raw: string): string {
  let u = (raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

// Hosts we know how to check reliably. Anything else (YouTube, Instagram,
// articles, archives...) is left unchecked rather than guessed at.
export function isCheckableLink(url: string): boolean {
  return /pixeldrain\.com\/u\/|pillows\.su\/f\/|pillowcase\.su\/f\/|imgur\.gg\/f\/|krakenfiles\.com\/view\/|drive\.google\.com\/(file\/d\/|open\?id=|uc\?)/i.test(url);
}

function probeFor(url: string, env: { PIXELDRAIN_PROXY_URL?: string }): { target: string; init: RequestInit } | null {
  const proxy = (env.PIXELDRAIN_PROXY_URL || DEFAULT_PIXELDRAIN_PROXY_URL).replace(/\/$/, '');
  const ua = { 'User-Agent': 'Mozilla/5.0 (compatible; UnvaultedLinkCheck/1.0)' };

  if (/pixeldrain\.com\/u\//i.test(url)) {
    const id = url.split('/u/')[1]?.split(/[?#/]/)[0];
    return id ? { target: `${proxy}/api/${id}`, init: { method: 'HEAD' } } : null;
  }
  if (/(pillows|pillowcase)\.su\/f\//i.test(url)) {
    const id = url.split('/f/')[1]?.split(/[?#/]/)[0];
    return id ? { target: `https://api.pillows.su/api/get/${id}`, init: { headers: { ...ua, Range: 'bytes=0-0' } } } : null;
  }
  if (/imgur\.gg\/f\//i.test(url)) {
    const id = url.split('/f/')[1]?.split(/[?#/]/)[0];
    return id ? { target: `https://imgur.gg/api/file/${id}`, init: { headers: ua } } : null;
  }
  if (/krakenfiles\.com\/view\//i.test(url)) {
    return { target: url, init: { headers: ua } };
  }
  if (/drive\.google\.com/i.test(url)) {
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? { target: `https://drive.google.com/file/d/${m[1]}/view`, init: { headers: ua } } : null;
  }
  return null;
}

export async function checkLink(url: string, env: { PIXELDRAIN_PROXY_URL?: string }): Promise<LinkCheckResult> {
  const probe = probeFor(url, env);
  if (!probe) return { status: 'unknown', httpStatus: null, detail: 'Host not checkable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(probe.target, { ...probe.init, redirect: 'follow', signal: controller.signal });
    // Don't download file bodies — we only need the status line.
    res.body?.cancel().catch(() => {});
    if (res.status === 404 || res.status === 410) {
      return { status: 'dead', httpStatus: res.status, detail: 'Host says the file is gone' };
    }
    if (res.ok) return { status: 'ok', httpStatus: res.status };
    return { status: 'unknown', httpStatus: res.status, detail: `HTTP ${res.status}` };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { status: 'unknown', httpStatus: null, detail: aborted ? 'Timed out' : 'Request failed' };
  } finally {
    clearTimeout(timer);
  }
}

// Upsert one check result. `dead_since` is kept from the first dead verdict so
// the dashboard can show how long a link has been down; an 'unknown' result
// never overwrites a previous definitive verdict (a flaky check shouldn't
// resurrect or bury a link).
export function upsertLinkStatus(
  db: D1Database,
  row: { tracker: string; url: string; era?: string | null; name?: string | null },
  result: LinkCheckResult,
  now = Date.now(),
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO link_status (tracker, url, era, name, status, http_status, detail, checked_at, dead_since)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CASE WHEN ?5 = 'dead' THEN ?8 ELSE NULL END)
     ON CONFLICT(tracker, url) DO UPDATE SET
       era = COALESCE(excluded.era, link_status.era),
       name = COALESCE(excluded.name, link_status.name),
       status = CASE WHEN excluded.status = 'unknown' AND link_status.status != 'unknown'
                     THEN link_status.status ELSE excluded.status END,
       http_status = excluded.http_status,
       detail = excluded.detail,
       checked_at = excluded.checked_at,
       dead_since = CASE
         WHEN excluded.status = 'dead' THEN COALESCE(link_status.dead_since, excluded.checked_at)
         WHEN excluded.status = 'ok' THEN NULL
         ELSE link_status.dead_since END`
  ).bind(row.tracker, row.url, row.era ?? null, row.name ?? null, result.status, result.httpStatus, result.detail ?? null, now);
}
