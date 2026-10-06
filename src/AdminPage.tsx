// Moderator dashboard at /admin: tracker data health, dead links, a live feed
// of entry comments, and the yeditsgold moderation tools (claims, community
// tracker review, owner-only admin keys — shared with /yeditsgold's panel).
//
// Health: runs /api/admin/health for every official tracker (a few at a time)
// and flags live sheets falling back to their committed snapshot, empty tabs,
// configured eras with 0 songs, and week-over-week row drops.
//
// Dead links: Cloudflare Pages has no cron, so scans are driven from here —
// "Scan" loads a tracker's songs, skips links checked in the last week, and
// posts the rest to /api/admin/link-check in small batches. Also lists dead
// links and open user/playback reports with recheck / mark-OK / resolve.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ARTIST_LIST } from './artists/registry';
import { getToken } from './comments';
import { YeditsAdminPanel, type YeditsAdminTab } from './components/YeditsAdminPanel';

const FRESH_MS = 7 * 86_400_000;
const SCAN_BATCH = 25;
const SCAN_CONCURRENCY = 3;
const HEALTH_CONCURRENCY = 4;

interface TabHealth { tab: string; source: string | null; rows: number; liveConfigured: boolean; liveError: string | null }
interface Issue { level: 'error' | 'warn' | 'info'; message: string }
interface HealthReport {
  tracker: string; tabs: TabHealth[]; songs: number; eraCount: number; emptyEras: string[];
  previous: { day: number; data: { songs: number } } | null; issues: Issue[];
}
interface DeadRow {
  tracker: string; url: string; era: string | null; name: string | null; http_status: number | null;
  detail: string | null; checked_at: number; dead_since: number | null; override: string | null; open_reports: number;
}
interface ReportRow {
  tracker: string; url: string; label: string | null; count: number; playback: number; user_reports: number;
  last_at: number; status: string | null; checked_at: number | null; detail: string | null;
}
interface TotalRow { tracker: string; checked: number; dead: number; unknown: number; last_checked: number }

const C = {
  bg: '#020617', card: '#0f172a', border: '#1e293b', text: '#e5e7eb', dim: '#94a3b8', faint: '#64748b',
  blue: '#60a5fa', red: '#f87171', amber: '#fbbf24', green: '#4ade80',
};

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data as T;
}

async function runPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

function ago(ts: number | null | undefined): string {
  if (!ts) return '—';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const SOURCE_LABEL: Record<string, string> = { live: 'live', 'sheets-api': 'api', committed: 'csv', community: 'db' };

const OFFICIAL = ARTIST_LIST.filter(a => !a.community);
const NAME_OF: Record<string, string> = Object.fromEntries(OFFICIAL.map(a => [a.slug, a.artistLabel || a.SITE_NAME || a.slug]));

type View = YeditsAdminTab | 'health' | 'links' | 'comments';
const VIEWS: { id: View; label: string; ownerOnly?: boolean }[] = [
  { id: 'health', label: 'Tracker health' },
  { id: 'links', label: 'Dead links' },
  { id: 'comments', label: 'Live comments' },
  { id: 'claims', label: 'Claims' },
  { id: 'trackers', label: 'Community trackers' },
  { id: 'keys', label: 'Admin keys', ownerOnly: true },
];

export function AdminPage() {
  const [view, setView] = useState<View>(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return VIEWS.some(x => x.id === v) ? v as View : 'health';
  });
  const [access, setAccess] = useState<'checking' | 'ok' | 'signin' | 'forbidden'>('checking');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setAccess('signin'); return; }
    api('/api/admin/links?tracker=__probe__&mode=status')
      .then(() => setAccess('ok'))
      .catch((e) => setAccess(e.status === 401 ? 'signin' : 'forbidden'));
    // Owner status gates the admin-keys tab (same check /yeditsgold uses).
    fetch('/api/yeditsgold-admin-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
      .then(r => r.ok ? r.json() : {})
      .then((d: { owner?: boolean }) => setIsOwner(!!d.owner))
      .catch(() => {});
  }, []);

  // Keep the chosen section in the URL so /admin?view=comments can be bookmarked.
  const pick = (v: View) => {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set('view', v);
    window.history.replaceState(null, '', url);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 16px 80px' }}>
        <Link to="/" style={{ color: C.blue, textDecoration: 'none', fontSize: 14 }}>← Home</Link>
        <h1 style={{ fontSize: 28, margin: '10px 0 4px' }}>Admin</h1>
        <p style={{ color: C.dim, margin: '0 0 20px' }}>Tracker health, dead links, live comments, and moderation.</p>

        {access === 'checking' && <p style={{ color: C.faint }}>Checking access…</p>}
        {(access === 'signin' || access === 'forbidden') && <Navigate to="/" replace />}
        {access === 'ok' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {VIEWS.filter(v => !v.ownerOnly || isOwner).map(v => (
                <button key={v.id} onClick={() => pick(v.id)} style={tabBtn(view === v.id)}>{v.label}</button>
              ))}
            </div>
            {view === 'health' && <HealthView />}
            {view === 'links' && <LinksView />}
            {view === 'comments' && <CommentsView />}
            {(view === 'claims' || view === 'trackers' || (view === 'keys' && isOwner)) && (
              <YeditsAdminPanel key={view} embedded tab={view} isOwner={isOwner} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#1d4ed8' : C.card, color: active ? '#fff' : C.dim, border: `1px solid ${active ? '#1d4ed8' : C.border}`,
    borderRadius: 999, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };
}

function smallBtn(color = C.blue): React.CSSProperties {
  return {
    background: 'transparent', color, border: `1px solid ${C.border}`, borderRadius: 6,
    padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}

// ---- Health -----------------------------------------------------------------

function HealthView() {
  const [reports, setReports] = useState<Record<string, HealthReport | { error: string } | 'loading'>>({});
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const runOne = useCallback(async (slug: string) => {
    setReports(r => ({ ...r, [slug]: 'loading' }));
    try {
      const rep = await api<HealthReport>(`/api/admin/health?tracker=${slug}`);
      setReports(r => ({ ...r, [slug]: rep }));
    } catch (e) {
      setReports(r => ({ ...r, [slug]: { error: (e as Error).message } }));
    }
  }, []);

  const runAll = async () => {
    setRunning(true);
    await runPool(OFFICIAL.map(a => a.slug), HEALTH_CONCURRENCY, runOne);
    setRunning(false);
  };

  const severity = (rep: HealthReport | { error: string } | 'loading' | undefined): number => {
    if (!rep || rep === 'loading') return -1;
    if ('error' in rep) return 3;
    if (rep.issues.some(i => i.level === 'error')) return 2;
    if (rep.issues.some(i => i.level === 'warn')) return 1;
    return 0;
  };

  const rows = useMemo(() => {
    const list = [...OFFICIAL].sort((a, b) => severity(reports[b.slug]) - severity(reports[a.slug]) || a.slug.localeCompare(b.slug));
    return onlyProblems ? list.filter(a => severity(reports[a.slug]) > 0) : list;
  }, [reports, onlyProblems]);

  const done = Object.values(reports).filter(r => r !== 'loading').length;

  // Plain-text issue list for pasting into a chat/issue, grouped by tracker.
  // A tracker that has both errors and warnings shows up in both copies.
  const issueText = (levels: Issue['level'][]) => () => {
    const blocks: string[] = [];
    for (const a of OFFICIAL) {
      const rep = reports[a.slug];
      if (!rep || rep === 'loading') continue;
      const lines = 'error' in rep
        ? (levels.includes('error') ? [`- [error] Health check failed: ${rep.error}`] : [])
        : rep.issues.filter(i => levels.includes(i.level)).map(i => `- ${levels.length > 1 ? `[${i.level}] ` : ''}${i.message}`);
      if (lines.length) blocks.push(`${NAME_OF[a.slug]} (/${a.slug})\n${lines.join('\n')}`);
    }
    return blocks.join('\n\n');
  };
  const errorText = issueText(['error']);
  const warningText = issueText(['warn']);
  const allIssuesText = issueText(['error', 'warn']);
  const hasWarnings = Object.values(reports).some(r => r && r !== 'loading' && !('error' in r) && r.issues.some(i => i.level === 'warn'));
  const counts = [0, 1, 2, 3].map(lv => Object.values(reports).filter(r => severity(r) === lv).length);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={runAll} disabled={running} style={{ ...tabBtn(true), opacity: running ? 0.6 : 1 }}>
          {running ? `Checking… ${done}/${OFFICIAL.length}` : 'Run health check on all trackers'}
        </button>
        {done > 0 && (
          <span style={{ color: C.dim, fontSize: 13 }}>
            <span style={{ color: C.green }}>{counts[0]} healthy</span> · <span style={{ color: C.amber }}>{counts[1]} warnings</span> · <span style={{ color: C.red }}>{counts[2] + counts[3]} errors</span>
          </span>
        )}
        {counts[2] + counts[3] > 0 && <CopyButton label="Copy errors" getText={errorText} />}
        {hasWarnings && <CopyButton label="Copy warnings" getText={warningText} />}
        {counts[2] + counts[3] > 0 && hasWarnings && <CopyButton label="Copy all issues" getText={allIssuesText} />}
        <label style={{ color: C.dim, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} /> Only show problems
        </label>
      </div>
      <p style={{ color: C.faint, fontSize: 12, margin: '0 0 12px' }}>
        Sources: <b>live</b> = live Google Sheet, <b>api</b> = Sheets API, <b>csv</b> = committed snapshot. A live tab showing <span style={{ color: C.amber }}>csv</span> means the sheet fetch failed and the site is serving stale data.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(a => {
          const rep = reports[a.slug];
          const sev = severity(rep);
          const dot = sev === -1 ? C.faint : sev === 0 ? C.green : sev === 1 ? C.amber : C.red;
          const isOpen = expanded === a.slug;
          return (
            <div key={a.slug} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <div
                onClick={() => rep && rep !== 'loading' && setExpanded(isOpen ? null : a.slug)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: rep && rep !== 'loading' ? 'pointer' : 'default', flexWrap: 'wrap' }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, minWidth: 150 }}>{NAME_OF[a.slug]} <span style={{ color: C.faint, fontWeight: 400, fontSize: 12 }}>/{a.slug}</span></span>
                {rep === 'loading' && <span style={{ color: C.faint, fontSize: 13 }}>Checking…</span>}
                {rep && rep !== 'loading' && 'error' in rep && <span style={{ color: C.red, fontSize: 13 }}>{rep.error}</span>}
                {rep && rep !== 'loading' && !('error' in rep) && (
                  <>
                    <span style={{ color: C.dim, fontSize: 13 }}>
                      {rep.songs.toLocaleString()} songs · {rep.eraCount} eras
                      {rep.previous && rep.previous.data.songs !== rep.songs && (
                        <span style={{ color: rep.songs < rep.previous.data.songs ? C.amber : C.green }}>
                          {' '}({rep.songs - rep.previous.data.songs > 0 ? '+' : ''}{rep.songs - rep.previous.data.songs} vs last week)
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {rep.tabs.filter(t => t.source || t.liveConfigured).map(t => {
                        const fellBack = t.liveConfigured && t.source !== 'live' && t.source !== 'sheets-api';
                        return (
                          <span key={t.tab} title={t.liveError || `${t.rows} rows`} style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 4, border: `1px solid ${C.border}`,
                            color: fellBack ? C.amber : t.rows === 0 ? C.red : C.dim,
                          }}>
                            {t.tab} <span style={{ opacity: 0.7 }}>{t.source ? SOURCE_LABEL[t.source] : 'none'}·{t.rows}</span>
                          </span>
                        );
                      })}
                    </span>
                    {rep.issues.length > 0 && <span style={{ marginLeft: 'auto', color: dot, fontSize: 13 }}>{rep.issues.length} issue{rep.issues.length === 1 ? '' : 's'} {isOpen ? '▴' : '▾'}</span>}
                  </>
                )}
                {!rep && <button onClick={(e) => { e.stopPropagation(); runOne(a.slug); }} style={{ ...smallBtn(), marginLeft: 'auto' }}>Check</button>}
              </div>
              {isOpen && rep && rep !== 'loading' && !('error' in rep) && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px 12px 35px', fontSize: 13 }}>
                  {rep.issues.length === 0 && <div style={{ color: C.green }}>No issues.</div>}
                  {rep.issues.map((i, k) => (
                    <div key={k} style={{ color: i.level === 'error' ? C.red : i.level === 'warn' ? C.amber : C.dim, margin: '3px 0', wordBreak: 'break-word' }}>
                      {i.level === 'error' ? '✕' : '!'} {i.message}
                    </div>
                  ))}
                  <button onClick={() => runOne(a.slug)} style={{ ...smallBtn(), marginTop: 8 }}>Re-check</button>
                  <Link to={`/${a.slug}/`} style={{ ...smallBtn(), marginLeft: 8, textDecoration: 'none', display: 'inline-block' }}>Open tracker</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Dead links ---------------------------------------------------------------

interface ScanState { phase: 'loading' | 'checking' | 'done' | 'error'; total: number; checked: number; dead: number; skipped: number; error?: string }

function collectLinks(data: { eras?: Record<string, { name: string; data?: Record<string, any[]> }> }) {
  const out: { url: string; era: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const era of Object.values(data.eras ?? {})) {
    for (const bucket of Object.values(era.data ?? {})) {
      if (!Array.isArray(bucket)) continue;
      for (const song of bucket) {
        const url = (song?.url || song?.urls?.[0] || '').trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({ url, era: era.name, name: song.name || '' });
      }
    }
  }
  return out;
}

function LinksView() {
  const [dead, setDead] = useState<DeadRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<Record<string, TotalRow>>({});
  const [filter, setFilter] = useState('');
  const [scans, setScans] = useState<Record<string, ScanState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const scanAllRef = useRef(false);

  const refresh = useCallback(async () => {
    const q = filter ? `?tracker=${filter}` : '';
    const d = await api<{ dead: DeadRow[]; reports: ReportRow[]; totals: TotalRow[] }>(`/api/admin/links${q}`);
    setDead(d.dead);
    setReports(d.reports);
    setTotals(Object.fromEntries(d.totals.map(t => [t.tracker, t])));
  }, [filter]);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  const scan = useCallback(async (slug: string) => {
    const set = (s: Partial<ScanState>) => setScans(prev => ({ ...prev, [slug]: { ...(prev[slug] as ScanState), ...s } }));
    setScans(prev => ({ ...prev, [slug]: { phase: 'loading', total: 0, checked: 0, dead: 0, skipped: 0 } }));
    try {
      const [eraData, statuses] = await Promise.all([
        fetch(`/api/${slug}/a`).then(r => r.json()),
        api<{ statuses: { url: string; checked_at: number }[] }>(`/api/admin/links?tracker=${slug}&mode=status`),
      ]);
      const fresh = new Map(statuses.statuses.map(s => [s.url, s.checked_at]));
      const now = Date.now();
      const all = collectLinks(eraData).filter(l => CHECKABLE.test(l.url));
      const todo = force ? all : all.filter(l => {
        const t = fresh.get(normalize(l.url));
        return !t || now - t > FRESH_MS;
      });
      set({ phase: 'checking', total: todo.length, skipped: all.length - todo.length });
      const batches: typeof todo[] = [];
      for (let i = 0; i < todo.length; i += SCAN_BATCH) batches.push(todo.slice(i, i + SCAN_BATCH));
      let checked = 0, deadCount = 0;
      await runPool(batches, SCAN_CONCURRENCY, async (batch) => {
        const res = await api<{ checked: number; results: { status: string }[] }>('/api/admin/link-check', {
          method: 'POST', body: JSON.stringify({ tracker: slug, links: batch }),
        }).catch(() => ({ checked: 0, results: [] }));
        checked += batch.length;
        deadCount += res.results.filter(r => r.status === 'dead').length;
        set({ checked, dead: deadCount });
      });
      set({ phase: 'done' });
    } catch (e) {
      set({ phase: 'error', error: (e as Error).message });
    }
  }, [force]);

  const scanAll = async () => {
    scanAllRef.current = true;
    for (const a of OFFICIAL) {
      if (!scanAllRef.current) break;
      await scan(a.slug);
    }
    scanAllRef.current = false;
    refresh().catch(() => {});
  };

  const act = async (action: string, tracker: string, url: string) => {
    setBusy(`${action}:${tracker}:${url}`);
    try {
      await api('/api/admin/links', { method: 'POST', body: JSON.stringify({ action, tracker, url }) });
      await refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const liveDead = dead.filter(d => d.override !== 'ok');
  const deadText = () => liveDead.map(d =>
    `${NAME_OF[d.tracker] || d.tracker}${d.era ? ` · ${d.era}` : ''} · ${d.name || '(untitled)'} — ${d.url} (HTTP ${d.http_status ?? '—'})`,
  ).join('\n');
  const deadUrls = () => liveDead.map(d => d.url).join('\n');

  const isBusy = (action: string, t: string, u: string) => busy === `${action}:${t}:${u}`;
  const anyScanning = Object.values(scans).some(s => s.phase === 'loading' || s.phase === 'checking');

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
          <option value="">All trackers</option>
          {OFFICIAL.map(a => <option key={a.slug} value={a.slug}>{NAME_OF[a.slug]}</option>)}
        </select>
        {filter
          ? <button onClick={() => scan(filter).then(refresh)} disabled={anyScanning} style={{ ...tabBtn(true), opacity: anyScanning ? 0.6 : 1 }}>Scan {NAME_OF[filter]}</button>
          : <button onClick={anyScanning ? () => { scanAllRef.current = false; } : scanAll} style={tabBtn(true)}>{anyScanning ? 'Stop after current tracker' : 'Scan all trackers'}</button>}
        <label style={{ color: C.dim, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} /> Re-check links checked this week
        </label>
        <button onClick={() => refresh()} style={{ ...smallBtn(), marginLeft: 'auto' }}>Refresh</button>
      </div>
      <p style={{ color: C.faint, fontSize: 12, margin: '0 0 16px' }}>
        Checks pixeldrain, pillows, imgur.gg, krakenfiles and Google Drive links. A link is only marked dead when the host says the file is gone (404/410).
      </p>

      <Section title="Scan coverage">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
          {OFFICIAL.filter(a => !filter || a.slug === filter).map(a => {
            const t = totals[a.slug];
            const s = scans[a.slug];
            return (
              <div key={a.slug} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 13 }}>{NAME_OF[a.slug]}</b>
                  {!s || s.phase === 'done' || s.phase === 'error'
                    ? <button onClick={() => scan(a.slug).then(refresh)} disabled={anyScanning} style={{ ...smallBtn(), padding: '1px 8px' }}>Scan</button>
                    : null}
                </div>
                <div style={{ color: C.dim, marginTop: 3 }}>
                  {t ? <>{t.checked} checked · <span style={{ color: t.dead ? C.red : C.dim }}>{t.dead} dead</span> · {ago(t.last_checked)}</> : 'Never scanned'}
                </div>
                {s && (
                  <div style={{ color: s.phase === 'error' ? C.red : C.blue, marginTop: 3 }}>
                    {s.phase === 'loading' && 'Loading songs…'}
                    {s.phase === 'checking' && `Checking ${s.checked}/${s.total}${s.dead ? ` · ${s.dead} dead` : ''}`}
                    {s.phase === 'done' && `Done: ${s.total} checked, ${s.dead} dead${s.skipped ? `, ${s.skipped} fresh skipped` : ''}`}
                    {s.phase === 'error' && s.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={`Open reports (${reports.length})`}>
        {reports.length === 0 ? <Empty text="No open reports." /> : reports.map(r => (
          <Row key={r.tracker + r.url}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.label || '(untitled)'} <span style={{ color: C.faint, fontWeight: 400 }}>· {NAME_OF[r.tracker] || r.tracker}</span></div>
              <LinkText url={r.url} />
              <div style={{ color: C.dim, fontSize: 12 }}>
                {r.count} report{r.count === 1 ? '' : 's'} ({r.user_reports} user, {r.playback} playback) · last {ago(r.last_at)} ·{' '}
                <StatusText status={r.status} /> {r.checked_at ? `(checked ${ago(r.checked_at)})` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => act('recheck', r.tracker, r.url)} style={smallBtn()}>{isBusy('recheck', r.tracker, r.url) ? '…' : 'Recheck'}</button>
              <button onClick={() => act('resolve', r.tracker, r.url)} style={smallBtn(C.dim)}>{isBusy('resolve', r.tracker, r.url) ? '…' : 'Dismiss'}</button>
            </div>
          </Row>
        ))}
      </Section>

      <Section
        title={`Dead links (${dead.length}${dead.length === 500 ? '+' : ''})`}
        action={liveDead.length > 0 && (
          <>
            <CopyButton label="Copy list" getText={deadText} />
            <CopyButton label="Copy URLs" getText={deadUrls} />
          </>
        )}
      >
        {dead.length === 0 ? <Empty text="No dead links found yet. Run a scan." /> : dead.map(d => (
          <Row key={d.tracker + d.url} dim={d.override === 'ok'}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {d.name || '(untitled)'} <span style={{ color: C.faint, fontWeight: 400 }}>· {d.era ? `${d.era} · ` : ''}{NAME_OF[d.tracker] || d.tracker}</span>
                {d.override === 'ok' && <span style={{ color: C.green, fontSize: 11, marginLeft: 6 }}>marked OK</span>}
              </div>
              <LinkText url={d.url} />
              <div style={{ color: C.dim, fontSize: 12 }}>
                HTTP {d.http_status ?? '—'} · dead since {ago(d.dead_since)} · checked {ago(d.checked_at)}
                {d.open_reports > 0 && ` · ${d.open_reports} open report${d.open_reports === 1 ? '' : 's'}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => act('recheck', d.tracker, d.url)} style={smallBtn()}>{isBusy('recheck', d.tracker, d.url) ? '…' : 'Recheck'}</button>
              {d.override === 'ok'
                ? <button onClick={() => act('clear-override', d.tracker, d.url)} style={smallBtn(C.dim)}>Undo OK</button>
                : <button onClick={() => act('mark-ok', d.tracker, d.url)} style={smallBtn(C.green)} title="False positive — never show as dead">Mark OK</button>}
            </div>
          </Row>
        ))}
      </Section>
    </div>
  );
}

// ---- Live comments ----------------------------------------------------------

interface CommentRow {
  id: string; tracker_id: string; entry_key: string; entry_label: string | null; entry_type: string | null;
  parent_id: string | null; user_id: string; username: string; body: string; created_at: number;
}

const COMMENTS_POLL_MS = 5000;
const NEW_HIGHLIGHT_MS = 15_000;

function CommentsView() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [tracker, setTracker] = useState('');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lastPoll, setLastPoll] = useState<number | null>(null);
  // id → when this tab first saw it; anything that arrives after the first load
  // gets a highlight so new comments stand out as they stream in.
  const firstSeen = useRef<Map<string, number>>(new Map());
  const primed = useRef(false);
  const [, tick] = useState(0);

  const poll = useCallback(async () => {
    const params = new URLSearchParams({ limit: '150' });
    if (tracker) params.set('tracker', tracker);
    if (query.trim()) params.set('q', query.trim());
    try {
      const data = await api<{ comments: CommentRow[] }>(`/api/admin/comments?${params}`);
      const now = Date.now();
      const seen = firstSeen.current;
      for (const c of data.comments) if (!seen.has(c.id)) seen.set(c.id, primed.current ? now : 0);
      primed.current = true;
      setComments(data.comments);
      setError(null);
      setLastPoll(now);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [tracker, query]);

  // Changing the filter is a fresh feed: don't flash everything as new.
  useEffect(() => { firstSeen.current = new Map(); primed.current = false; }, [tracker, query]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(poll, query ? 300 : 0); // debounce typing in the search box
    const id = setInterval(() => { if (!document.hidden) poll(); }, COMMENTS_POLL_MS);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(t); clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [poll, paused, query]);

  // Re-render once a second so "Xs ago" and the new-comment highlight fade stay current.
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remove = async (c: CommentRow) => {
    if (!confirm(`Delete this comment by @${c.username}?`)) return;
    setDeleting(c.id);
    try {
      await api(`/api/comments?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      setComments(list => list.filter(x => x.id !== c.id));
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeleting(null);
    }
  };

  const trackerOptions = useMemo(
    () => ARTIST_LIST.filter(a => !a.hidden || a.slug === tracker).map(a => ({ slug: a.slug, name: a.artistLabel || a.SITE_NAME || a.slug })),
    [tracker],
  );
  const nameOf = (slug: string) => trackerOptions.find(t => t.slug === slug)?.name || slug;
  const now = Date.now();
  const newCount = comments.filter(c => (firstSeen.current.get(c.id) ?? 0) > 0).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: paused ? C.faint : C.green }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: paused ? C.faint : C.green, boxShadow: paused ? 'none' : `0 0 8px ${C.green}` }} />
          {paused ? 'Paused' : 'Live'}
        </span>
        <button onClick={() => setPaused(p => !p)} style={smallBtn(paused ? C.green : C.dim)}>{paused ? 'Resume' : 'Pause'}</button>
        <select value={tracker} onChange={e => setTracker(e.target.value)} style={inputStyle}>
          <option value="">All trackers</option>
          {trackerOptions.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
        </select>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search text, user, entry…" style={{ ...inputStyle, minWidth: 200 }} />
        <span style={{ color: C.faint, fontSize: 12, marginLeft: 'auto' }}>
          {newCount > 0 && <span style={{ color: C.blue, marginRight: 8 }}>{newCount} new since opened</span>}
          {lastPoll ? `Updated ${Math.max(0, Math.round((now - lastPoll) / 1000))}s ago` : ''}
        </span>
      </div>

      {error && <p style={{ color: C.red, fontSize: 13 }}>Couldn't load comments: {error}</p>}
      {!loaded && <Empty text="Loading comments…" />}
      {loaded && comments.length === 0 && !error && <Empty text="No comments yet." />}

      {comments.map(c => {
        const seenAt = firstSeen.current.get(c.id) ?? 0;
        const fresh = seenAt > 0 && now - seenAt < NEW_HIGHLIGHT_MS;
        return (
          <div key={c.id} style={{
            background: fresh ? '#0c1f3d' : C.card, border: `1px solid ${fresh ? '#1d4ed8' : C.border}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 6, fontSize: 14, transition: 'background 1s, border-color 1s',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <b>@{c.username}</b>
              {c.parent_id && <span style={{ color: C.faint, fontSize: 12 }}>replied</span>}
              <span style={{ color: C.faint, fontSize: 12 }}>on</span>
              <a href={`/${c.tracker_id}/`} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 13, textDecoration: 'none' }}>
                {c.entry_label || c.entry_key}
              </a>
              <span style={{ color: C.faint, fontSize: 12 }}>
                · {nameOf(c.tracker_id)}{c.entry_type ? ` · ${c.entry_type}` : ''}
              </span>
              <span title={new Date(c.created_at).toLocaleString()} style={{ color: C.faint, fontSize: 12, marginLeft: 'auto' }}>
                {now - c.created_at < 60_000 ? 'just now' : ago(c.created_at)}
              </span>
              <button onClick={() => remove(c)} disabled={deleting === c.id} style={smallBtn(C.red)}>
                {deleting === c.id ? '…' : 'Delete'}
              </button>
            </div>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: C.text }}>{c.body}</div>
          </div>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 13,
};

// Mirrors functions/api/links/_links.ts isCheckableLink / normalizeLinkUrl.
const CHECKABLE = /pixeldrain\.com\/u\/|pillows\.su\/f\/|pillowcase\.su\/f\/|imgur\.gg\/f\/|krakenfiles\.com\/view\/|drive\.google\.com\/(file\/d\/|open\?id=|uc\?)/i;
function normalize(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }}>
        <h2 style={{ fontSize: 17, margin: 0, marginRight: 'auto' }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  };
  return (
    <button onClick={copy} style={smallBtn(state === 'copied' ? C.green : state === 'failed' ? C.red : C.blue)}>
      {state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}

function Row({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 6, fontSize: 14, opacity: dim ? 0.55 : 1,
    }}>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: C.faint, fontSize: 14, padding: '6px 0' }}>{text}</div>;
}

function LinkText({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 12, wordBreak: 'break-all', textDecoration: 'none' }}>{url}</a>
  );
}

function StatusText({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: C.faint }}>not checked</span>;
  const color = status === 'dead' ? C.red : status === 'ok' ? C.green : C.amber;
  return <span style={{ color }}>{status}</span>;
}
