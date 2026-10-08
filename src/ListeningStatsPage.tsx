import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchListeningStats,
  fetchListeningPref,
  setListeningPref,
  isListeningLoggedIn,
  importFromLastfm,
  type ImportProgress,
  type ImportResult,
} from './listening';
import { getLastfmUsername } from './lastfm';
import { ShareStatsCard } from './components/ShareStatsCard';

const ACCENT = '#C9A224';

interface VGUser { id: string; username: string; email: string; }
function getVGUser(): VGUser | null {
  try { return JSON.parse(localStorage.getItem('vg_user') || 'null'); } catch { return null; }
}

interface Summary {
  plays: number; minutes: number; uniqueTracks: number; uniqueArtists: number;
  uniqueEras: number; activeDays: number; firstPlay: number | null; lastPlay: number | null;
}
interface SongRow { track: string; artist: string; album: string; eraName: string; artistSlug: string; plays: number; totalSec: number; }
interface ArtistRow { artist: string; plays: number; totalSec: number; }
interface EraRow { eraName: string; artistSlug: string; plays: number; }
interface TrackerRow { artistSlug: string; plays: number; totalSec: number; }
interface DayRow { day: string; plays: number; }
interface HourRow { hour: number; plays: number; }
interface RecentRow { track: string; artist: string; eraName: string; artistSlug: string; playedAt: number; }
interface Stats {
  range: string; summary: Summary;
  topSongs: SongRow[]; topArtists: ArtistRow[]; topEras: EraRow[]; topTrackers: TrackerRow[];
  perDay: DayRow[]; byHour: HourRow[]; recent: RecentRow[];
}

const RANGES: { key: string; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '365d', label: '1 year' },
  { key: 'all', label: 'All time' },
];

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function titleCaseSlug(slug: string): string {
  return slug ? slug.replace(/gold$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ListeningStatsPage() {
  const navigate = useNavigate();
  const user = getVGUser();
  const [range, setRange] = useState('30d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const lastfmUsername = getLastfmUsername();
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isListeningLoggedIn()) return;
    fetchListeningPref().then(setEnabled).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isListeningLoggedIn()) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchListeningStats(range)
      .then((s: Stats) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setError('Could not load your stats. Try again in a moment.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const summaryText = useMemo(() => {
    if (!stats) return '';
    const s = stats.summary;
    const top = stats.topSongs[0];
    const topArt = stats.topArtists[0];
    const label = RANGES.find(r => r.key === range)?.label ?? range;
    return [
      `My UNVAULTED listening — ${label}`,
      `${s.plays} plays · ${fmtMinutes(s.minutes)} · ${s.uniqueTracks} tracks`,
      top ? `#1 song: ${top.track}${top.artist ? ` — ${top.artist}` : ''} (${top.plays}×)` : '',
      topArt ? `#1 artist: ${topArt.artist} (${topArt.plays}×)` : '',
      `unvaulted.cc`,
    ].filter(Boolean).join('\n');
  }, [stats, range]);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    try { await setListeningPref(next); } catch { setEnabled(!next); }
  }

  async function runImport() {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    setImportProgress(null);
    try {
      const result = await importFromLastfm(lastfmUsername, setImportProgress);
      setImportResult(result);
      // Refresh stats so the newly imported plays show up immediately.
      const s = await fetchListeningStats(range);
      setStats(s);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function copySummary() {
    navigator.clipboard?.writeText(summaryText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  // --- Not signed in ---
  if (!isListeningLoggedIn() || !user) {
    return (
      <Shell onBack={() => navigate('/')}>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.6)' }}>
          <h1 style={{ ...titleStyle, marginBottom: 12 }}>YOUR <span style={{ color: ACCENT }}>LISTENING</span></h1>
          <p style={{ maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Sign in to your UNVAULTED account to track what you play across every tracker and see your personal stats.
          </p>
          <a href="/" style={btnPrimary}>Go to sign in</a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onBack={() => navigate('/')}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={titleStyle}>YOUR <span style={{ color: ACCENT }}>LISTENING</span></h1>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>Signed in as {user.username}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{ ...chip, ...(range === r.key ? chipActive : {}) }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={muted}>Loading your stats…</div>}
      {error && <div style={{ ...muted, color: '#ff8080' }}>{error}</div>}

      {!loading && !error && stats && stats.summary.plays === 0 && (
        <div style={{ ...panel, textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.6)' }}>
          No plays recorded in this window yet. Start playing songs on any tracker and they'll show up here.
        </div>
      )}

      {!loading && !error && stats && stats.summary.plays > 0 && (
        <>
          {/* Summary hero */}
          <div style={statGrid}>
            <StatCard big value={String(stats.summary.plays)} label="Plays" />
            <StatCard big value={fmtMinutes(stats.summary.minutes)} label="Listening time" />
            <StatCard value={String(stats.summary.uniqueTracks)} label="Unique tracks" />
            <StatCard value={String(stats.summary.uniqueArtists)} label="Artists" />
            <StatCard value={String(stats.summary.uniqueEras)} label="Eras" />
            <StatCard value={String(stats.summary.activeDays)} label="Active days" />
          </div>

          {/* Plays over time */}
          {stats.perDay.length > 1 && (
            <Section title="Plays over time">
              <BarChart data={stats.perDay.map(d => ({ label: d.day, value: d.plays }))} />
            </Section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Top songs */}
            <Section title="Top songs">
              <RankList items={stats.topSongs.slice(0, 15).map((s, i) => ({
                key: `${s.track}-${i}`,
                primary: s.track,
                secondary: [s.artist, titleCaseSlug(s.artistSlug)].filter(Boolean).join(' · '),
                count: s.plays,
              }))} />
            </Section>

            {/* Top artists */}
            <Section title="Top artists">
              <RankList items={stats.topArtists.slice(0, 15).map((a, i) => ({
                key: `${a.artist}-${i}`,
                primary: a.artist || 'Unknown',
                secondary: fmtMinutes(Math.round(a.totalSec / 60)),
                count: a.plays,
              }))} />
            </Section>

            {/* Top eras */}
            <Section title="Top eras">
              <RankList items={stats.topEras.slice(0, 15).map((e, i) => ({
                key: `${e.eraName}-${i}`,
                primary: e.eraName,
                secondary: titleCaseSlug(e.artistSlug),
                count: e.plays,
              }))} />
            </Section>

            {/* Top trackers */}
            <Section title="Top trackers">
              <RankList items={stats.topTrackers.slice(0, 15).map((t, i) => ({
                key: `${t.artistSlug}-${i}`,
                primary: titleCaseSlug(t.artistSlug) || t.artistSlug,
                secondary: fmtMinutes(Math.round(t.totalSec / 60)),
                count: t.plays,
                href: t.artistSlug ? `/${t.artistSlug}` : undefined,
              }))} />
            </Section>
          </div>

          {/* Listening clock */}
          {stats.byHour.length > 0 && (
            <Section title="When you listen">
              <BarChart
                data={(() => {
                  const offsetHours = Math.round(-new Date().getTimezoneOffset() / 60);
                  return Array.from({ length: 24 }, (_, h) => ({
                    label: `${h}`,
                    value: stats.byHour.find(x => x.hour === ((h - offsetHours) % 24 + 24) % 24)?.plays ?? 0,
                  }));
                })()}
                everyLabel={3}
              />
            </Section>
          )}

          {/* Recent */}
          <Section title="Recently played">
            <div>
              {stats.recent.slice(0, 30).map((r, i) => (
                <div key={i} style={recentRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.track}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[r.artist, titleCaseSlug(r.artistSlug)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{fmtDate(r.playedAt)}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Share */}
          <Section title="Share your stats">
            {getVGUser() && <ShareStatsCard username={getVGUser()!.username} accent={ACCENT} />}
            <pre style={sharePre}>{summaryText}</pre>
            <button onClick={copySummary} style={btnPrimary}>{copied ? 'Copied!' : 'Copy summary'}</button>
          </Section>
        </>
      )}

      {/* Last.fm backfill — only when a Last.fm account is connected */}
      {lastfmUsername && (
        <Section title="Import from Last.fm">
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
            Scan your Last.fm history (<span style={{ color: ACCENT }}>{lastfmUsername}</span>) and add any
            scrobbles that match songs on the trackers to your listening stats. Safe to run more than once —
            already-imported plays are skipped.
          </div>

          {importProgress && importing && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
              Scanning page {importProgress.page} of {importProgress.totalPages} · {importProgress.scanned} scrobbles checked · {importProgress.matched + importProgress.imported} matched
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((importProgress.page / Math.max(1, importProgress.totalPages)) * 100)}%`, background: ACCENT, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {importResult && !importing && (
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 12 }}>
              Done — checked {importResult.scanned.toLocaleString()} scrobbles, matched {importResult.matched.toLocaleString()},
              added <span style={{ color: ACCENT, fontWeight: 700 }}>{importResult.imported.toLocaleString()}</span> new plays.
            </div>
          )}

          {importError && !importing && (
            <div style={{ fontSize: 14, color: '#ff8080', marginBottom: 12 }}>{importError}</div>
          )}

          <button onClick={runImport} disabled={importing} style={{ ...btnPrimary, opacity: importing ? 0.6 : 1, cursor: importing ? 'default' : 'pointer' }}>
            {importing ? 'Importing…' : importResult ? 'Run again' : 'Import my Last.fm history'}
          </button>
        </Section>
      )}

      {/* Opt-in toggle — always available when signed in */}
      <Section title="Privacy">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <span style={{
            width: 42, height: 24, borderRadius: 999, position: 'relative', flexShrink: 0,
            background: enabled ? ACCENT : 'rgba(255,255,255,0.15)', transition: 'background 0.15s',
          }}>
            <span style={{
              position: 'absolute', top: 3, left: enabled ? 21 : 3, width: 18, height: 18,
              borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
            }} />
          </span>
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} style={{ display: 'none' }} />
          <span style={{ fontSize: 14 }}>
            Record my listening history
            <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {enabled ? 'On — new plays are saved to your account.' : 'Off — new plays are not recorded.'}
            </span>
          </span>
        </label>
      </Section>
    </Shell>
  );
}

// --- Layout primitives ------------------------------------------------------

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 120px' }}>
        <button onClick={onBack} style={{ ...chip, marginBottom: 20 }}>← Back</button>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: '0 0 12px' }}>{title}</h2>
      <div style={panel}>{children}</div>
    </div>
  );
}

function StatCard({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <div style={{ ...panel, padding: '16px 18px' }}>
      <div style={{ fontSize: big ? 30 : 24, fontWeight: 800, color: big ? ACCENT : '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, letterSpacing: '0.03em' }}>{label}</div>
    </div>
  );
}

function RankList({ items }: { items: { key: string; primary: string; secondary?: string; count: number; href?: string }[] }) {
  if (!items.length) return <div style={muted}>No data yet.</div>;
  return (
    <div>
      {items.map((it, i) => {
        const body = (
          <>
            <span style={{ width: 22, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.primary}</span>
              {it.secondary && <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.secondary}</span>}
            </span>
            <span style={{ flexShrink: 0, color: ACCENT, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.count}</span>
          </>
        );
        const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', textDecoration: 'none', color: '#fff' };
        return it.href
          ? <a key={it.key} href={it.href} style={rowStyle}>{body}</a>
          : <div key={it.key} style={rowStyle}>{body}</div>;
      })}
    </div>
  );
}

function BarChart({ data, everyLabel }: { data: { label: string; value: number }[]; everyLabel?: number }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const step = everyLabel ?? Math.ceil(data.length / 8);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, overflow: 'hidden' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }} title={`${d.label}: ${d.value}`}>
          <div style={{
            width: '100%', maxWidth: 24, height: `${(d.value / max) * 92}px`, minHeight: d.value > 0 ? 2 : 0,
            background: ACCENT, borderRadius: '3px 3px 0 0', opacity: 0.85,
          }} />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            {i % step === 0 ? d.label.slice(5) || d.label : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Styles -----------------------------------------------------------------

const titleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 900, letterSpacing: '0.02em', margin: 0 };
const panel: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 };
const muted: React.CSSProperties = { color: 'rgba(255,255,255,0.45)', padding: '8px 0' };
const statGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 8 };
const recentRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const sharePre: React.CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '0 0 12px', lineHeight: 1.5 };
const chip: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const chipActive: React.CSSProperties = { background: ACCENT, borderColor: ACCENT, color: '#0a0a0a' };
const btnPrimary: React.CSSProperties = { display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: ACCENT, color: '#0a0a0a', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', textDecoration: 'none' };
