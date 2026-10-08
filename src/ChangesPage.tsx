// Tracker changelog — what changed on every tracker, newest first.
//
//   /changes          — all trackers
//   /changes/:slug    — one tracker (with an artist-level "Alerts" follow)
//
// Data comes from the scan/diff job in functions/api/changes/*; follows and the
// alert inbox live in src/alerts.ts.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Home, Bell, ExternalLink, Loader2, History } from 'lucide-react';
import { ARTIST_LIST, getArtistConfig } from './artists/registry';
import { Img, createSlug } from './utils';
import { FollowButton } from './components/FollowButton';
import { AlertsBell } from './components/AlertsBell';
import { fetchChanges, describeChange, timeAgo, KIND_META, type ChangeItem, type ChangeKind } from './alerts';

const ACCENT = '#F5C518';

const FILTERS: { id: string; label: string; kinds: ChangeKind[] }[] = [
  { id: 'highlights', label: 'Highlights', kinds: ['added', 'link_added', 'availability', 'quality', 'renamed'] },
  { id: 'new', label: 'New songs', kinds: ['added'] },
  { id: 'links', label: 'Links', kinds: ['link_added', 'link_changed', 'link_removed'] },
  { id: 'upgrades', label: 'Availability & quality', kinds: ['availability', 'quality'] },
  { id: 'renames', label: 'Renames & moves', kinds: ['renamed', 'moved'] },
  { id: 'removed', label: 'Removed', kinds: ['removed'] },
  { id: 'all', label: 'Everything', kinds: [] },
];

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

// One change row — shared with the alerts inbox.
export function ChangeRowItem({ c, showArtist, unread }: { c: ChangeItem; showArtist: boolean; unread?: boolean }) {
  const navigate = useNavigate();
  const cfg = getArtistConfig(c.slug);
  const meta = KIND_META[c.kind];
  const href = c.era ? `/${c.slug}/album/${createSlug(c.era)}` : `/${c.slug}`;
  const isResync = c.kind === 'resync';
  return (
    <div
      onClick={() => navigate(href)}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/5 ${unread ? 'bg-white/[0.04]' : ''}`}
    >
      {showArtist && (
        <Img src={cfg?.artistPhotoUrl || cfg?.logoUrl || ''} w={64} alt="" className="w-9 h-9 rounded-lg object-cover bg-white/5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          {unread && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />}
          <span className="font-semibold text-sm truncate">{isResync ? (cfg?.artistLabel || c.slug) : c.name}</span>
          <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${meta.className}`}>{meta.label}</span>
        </div>
        <div className="text-xs text-white/45 truncate">
          {!isResync && <>{showArtist && <>{cfg?.artistLabel || c.slug} · </>}{c.era} · </>}
          <span className="text-white/65">{describeChange(c)}</span>
        </div>
      </div>
      <span className="text-[11px] text-white/35 whitespace-nowrap shrink-0">{timeAgo(c.detected_at)}</span>
      <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
        {c.url && (
          <a href={c.url} target="_blank" rel="noopener noreferrer" title="Open link" className="p-1 rounded text-white/25 hover:text-white/80 hover:bg-white/10">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {!isResync && <FollowButton slug={c.slug} scope="song" target={c.name} label={c.name} />}
      </div>
    </div>
  );
}

export function ChangesPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const cfg = slug ? getArtistConfig(slug) : undefined;
  const [filter, setFilter] = useState('highlights');
  const [items, setItems] = useState<ChangeItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const kinds = FILTERS.find((f) => f.id === filter)!.kinds;

  useEffect(() => {
    document.title = `${cfg ? `${cfg.artistLabel} ` : ''}Changelog · unvaulted`;
  }, [cfg]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(false);
    fetchChanges({ slug, kinds })
      .then((d) => { if (!cancelled) { setItems(d.items); setNextBefore(d.nextBefore); setLastScanAt(d.lastScanAt); } })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, filter]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const d = await fetchChanges({ slug, kinds, before: nextBefore });
      setItems((prev) => [...(prev ?? []), ...d.items]);
      setNextBefore(d.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => {
    const out: { label: string; items: ChangeItem[] }[] = [];
    for (const c of items ?? []) {
      const label = dayLabel(c.detected_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c); else out.push({ label, items: [c] });
    }
    return out;
  }, [items]);

  const trackers = useMemo(() => ARTIST_LIST.filter((a) => !a.hidden), []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32" style={{ ['--theme-color' as any]: cfg?.accentColor || ACCENT }}>
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 md:px-8 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer transition-colors" title="Home">
            <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
          </button>
          <button onClick={() => navigate('/changes')} className="text-lg md:text-xl font-black tracking-tight ml-1 truncate cursor-pointer">
            TRACKER<span style={{ color: ACCENT }}>CHANGELOG</span>
          </button>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <AlertsBell />
          </div>
        </div>
        <div className="flex gap-1 px-4 md:px-8 pb-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${filter === f.id ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6">
        {cfg ? (
          <div className="flex items-center gap-4 mb-6">
            <Img src={cfg.artistPhotoUrl || cfg.logoUrl} w={128} alt="" className="w-14 h-14 rounded-xl object-cover bg-white/5" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black truncate">{cfg.artistLabel}</h1>
              <Link to={`/${cfg.slug}`} className="text-xs text-white/50 hover:text-white">Open tracker →</Link>
            </div>
            <FollowButton slug={cfg.slug} scope="artist" label={cfg.artistLabel} variant="pill" />
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-white/55 max-w-xl">
              Every song added, link posted, snippet that went full and rename across {trackers.length} trackers.
              Tap the <Bell className="inline w-3.5 h-3.5 -mt-0.5" /> on any song, era or tracker to get alerts.
            </p>
            <div className="flex gap-1.5 mt-4 overflow-x-auto no-scrollbar pb-1">
              {trackers.map((a) => (
                <Link key={a.slug} to={`/changes/${a.slug}`} title={a.artistLabel}
                  className="shrink-0 flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] text-white/70 hover:text-white">
                  <Img src={a.artistPhotoUrl || a.logoUrl} w={48} alt="" className="w-5 h-5 rounded-full object-cover" />
                  {a.artistLabel}
                </Link>
              ))}
            </div>
          </div>
        )}

        {error && <div className="text-center text-white/40 text-sm py-24">Couldn’t load the changelog.</div>}
        {!error && items === null && (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        )}
        {items && items.length === 0 && (
          <div className="text-center text-white/40 text-sm py-24 flex flex-col items-center gap-3">
            <History className="w-8 h-8 text-white/20" />
            <div>No changes recorded yet{cfg ? ` for ${cfg.artistLabel}` : ''}.</div>
            <div className="text-xs text-white/30 max-w-sm">
              The first check of each tracker only takes a snapshot. Changes show up here once a tracker is edited.
            </div>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.label} className="mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/35 px-3 mb-1">{g.label}</h2>
            {g.items.map((c) => <ChangeRowItem key={c.id} c={c} showArtist={!slug} />)}
          </section>
        ))}

        {nextBefore && (
          <div className="flex justify-center py-4">
            <button onClick={loadMore} disabled={loadingMore}
              className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/70 cursor-pointer disabled:opacity-50">
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
        {lastScanAt !== null && items && items.length > 0 && (
          <p className="text-center text-[11px] text-white/25 pt-4">Trackers are checked every ~15 minutes · oldest check {timeAgo(lastScanAt)}</p>
        )}
      </div>
    </div>
  );
}
