import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARTIST_LIST } from '../artists/registry';
import type { ArtistConfig } from '../artists/types';
import { createSlug, Img } from '../utils';

// One recently-leaked track, as returned by /api/feed.
interface FeedItem {
  slug: string;
  era: string;
  name: string;
  extra?: string;
  leak_date: string;
  leak_ts: number;
  quality: string;
  url: string;
}

const CONFIG_BY_SLUG: Record<string, ArtistConfig> = Object.fromEntries(
  ARTIST_LIST.map(c => [c.slug, c])
);

const INITIAL_COUNT = 12;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 0) return 'soon';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Resolve an item to its artist config + browsable era name, or null if the era
// isn't one the site displays (same gate App.tsx uses: era ∈ ALBUM_RELEASE_DATES).
function resolve(item: FeedItem): { config: ArtistConfig; era: string } | null {
  const config = CONFIG_BY_SLUG[item.slug];
  if (!config) return null;
  const era = config.ERA_MAPPINGS?.[item.era] ?? item.era;
  if (!(era in config.ALBUM_RELEASE_DATES)) return null;
  return { config, era };
}

// Break up long runs of the same artist so a prolific tracker doesn't fill the
// whole visible slice — keeps the newest-first order but jumps ahead to a
// different artist once `maxRun` in a row would be exceeded. This makes a
// "cross-artist" feed actually feel cross-artist near the top.
function spreadByArtist(items: FeedItem[], maxRun = 2): FeedItem[] {
  const pending = [...items];
  const out: FeedItem[] = [];
  while (pending.length) {
    let idx = 0;
    const n = out.length;
    if (n >= maxRun && out.slice(n - maxRun).every(x => x.slug === out[n - 1].slug)) {
      const alt = pending.findIndex(x => x.slug !== out[n - 1].slug);
      if (alt !== -1) idx = alt;
    }
    out.push(pending.splice(idx, 1)[0]);
  }
  return out;
}

export const NEW_WINDOW_MS = 7 * 86_400_000;

// Shared /api/feed loader so the home sidebar ("3 new") and the feed section
// reuse one request.
let feedPromise: Promise<FeedItem[]> | null = null;
function loadFeed(): Promise<FeedItem[]> {
  feedPromise ??= fetch('/api/feed')
    .then(r => r.ok ? r.json() : Promise.reject(new Error('feed failed')))
    .then((data: { items: FeedItem[] }) => (data.items ?? []).filter(resolve))
    .catch(err => { feedPromise = null; throw err; });
  return feedPromise;
}

export function useLeakFeed(): { items: FeedItem[] | null; failed: boolean } {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadFeed()
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  return { items, failed };
}

// Leaks per tracker within the "new" window, for the sidebar badges.
export function countNewBySlug(items: FeedItem[] | null): Record<string, number> {
  const out: Record<string, number> = {};
  const cutoff = Date.now() - NEW_WINDOW_MS;
  for (const it of items ?? []) {
    if (it.leak_ts >= cutoff && it.leak_ts <= Date.now()) out[it.slug] = (out[it.slug] ?? 0) + 1;
  }
  return out;
}

function FeedRow({ item }: { item: FeedItem }) {
  const navigate = useNavigate();
  const resolved = resolve(item);
  if (!resolved) return null;
  const { config, era } = resolved;
  const accent = config.accentColor;
  const href = `/${config.slug}/album/${createSlug(era)}`;

  return (
    <a
      href={href}
      onClick={e => { if (e.metaKey || e.ctrlKey || e.button !== 0) return; e.preventDefault(); navigate(href); }}
      className="feed-row"
    >
      <span style={{
        display: 'flex', width: 40, height: 40, borderRadius: 999, flexShrink: 0, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center', background: `${accent}26`,
        color: accent, fontWeight: 800, fontSize: 13,
      }} aria-hidden="true">
        {config.artistPhotoUrl
          ? <Img w={80} src={config.artistPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: config.photoObjectPosition ?? 'top center' }} />
          : config.cardLetter}
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.name}
          {item.extra && <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}> {item.extra}</span>}
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {config.artistLabel} · {era}
        </span>
      </span>

      {item.quality && <span className="feed-chip">{item.quality}</span>}
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 72, textAlign: 'right', flexShrink: 0 }}>
        {relativeTime(item.leak_ts)}
      </span>
    </a>
  );
}

export function WhatsNewFeed({ slugs, title = 'Recently leaked', subtitle = 'across all trackers' }: { slugs?: string[]; title?: string; subtitle?: string }) {
  const { items, failed } = useLeakFeed();
  const [showAll, setShowAll] = useState(false);

  if (failed) return null;

  const scoped = slugs && slugs.length ? (items ?? []).filter(i => slugs.includes(i.slug)) : (items ?? []);
  const browsable = spreadByArtist(scoped);
  if (items && browsable.length === 0) return null;

  const visible = showAll ? browsable : browsable.slice(0, INITIAL_COUNT);

  return (
    <section className="home-section" style={{ minWidth: 0 }}>
      <div className="home-section-head">
        <h2 className="home-h2">{title}</h2>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{subtitle}</span>
      </div>

      <div className="feed-list">
        {items === null
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="feed-row" style={{ background: 'rgba(255,255,255,0.02)' }} />)
          : visible.map((item, i) => <FeedRow key={`${item.slug}-${item.era}-${item.name}-${i}`} item={item} />)}
      </div>
      {browsable.length > INITIAL_COUNT && (
        <button onClick={() => setShowAll(v => !v)} className="home-ghost-btn" style={{ alignSelf: 'center' }}>
          {showAll ? 'Show less' : `Show ${browsable.length - INITIAL_COUNT} more`}
        </button>
      )}

      <style>{`
        .feed-list { display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; }
        .feed-row { display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 8px 14px; background: #111114; border-bottom: 1px solid rgba(255,255,255,0.05); text-decoration: none; color: inherit; transition: background 0.15s; }
        .feed-row:last-child { border-bottom: 0; }
        .feed-row:hover { background: #17171b; }
        .feed-chip { font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); white-space: nowrap; flex-shrink: 0; }
        @media (max-width: 600px) { .feed-chip { display: none; } }
      `}</style>
    </section>
  );
}
