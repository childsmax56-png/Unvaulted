// Cross-artist producer pages.
//
//   /producers       — searchable directory of every credited producer
//   /producers/:key  — everything one producer touched, across every tracker,
//                      grouped artist → era, playable through the global player
//
// Credits come from the "(prod. …)" text on each song, indexed server-side by
// functions/api/producers/* (edge-cached, refreshed hourly).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Home, ArrowLeft, Play, Pause, Shuffle, Search, ExternalLink, Disc3, Users, ListMusic, Layers } from 'lucide-react';
import * as audioStore from './player/audioStore';
import { getArtistConfig } from './artists/registry';
import { eraArtwork } from './eraArtwork';
import { Img, createSlug, isSongNotAvailable } from './utils';
import { AddToPlaylistButton } from './components/AddToPlaylistButton';
import type { Song, Era } from './types';

const ACCENT = '#F59E0B';
const PAGE_SIZE = 120;
// Rows shown per artist before "Show all" — big producers (Ye: ~4k rows) would
// otherwise render tens of thousands of DOM nodes.
const ARTIST_ROW_CAP = 50;

interface ProducerSummary { k: string; n: string; c: number; v: number; a: Record<string, number> }
interface CreditedSong {
  s: string; e: string; n: string; x?: string; u?: string; q?: string;
  l?: string; f?: string; d?: string; p: string[];
}
interface ProducerDetail {
  key: string;
  name: string;
  aliases: string[];
  songs: CreditedSong[];
  collaborators: { k: string; n: string; c: number }[];
}

function artistLabel(slug: string): string {
  return getArtistConfig(slug)?.artistLabel ?? slug;
}

function artistThumb(slug: string): string | undefined {
  const cfg = getArtistConfig(slug);
  return cfg?.artistPhotoUrl || cfg?.logoUrl;
}

// Mirrors songKey() in functions/api/producers/_index.ts — versions and
// cross-listed copies of one song count once.
function songKey(name: string): string {
  const title = name.includes(' - ') ? name.slice(name.indexOf(' - ') + 3) : name;
  return title.toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^a-z0-9]/g, '');
}

function isPlayable(row: CreditedSong): boolean {
  return !!row.u && !isSongNotAvailable({ quality: row.q }, row.u) && audioStore.isDirectlyPlayableAudio(row.u);
}

// Shape a credited row like a tracker song so the global player, playlists and
// media session treat it exactly like one played from inside the tracker.
function toSong(row: CreditedSong): Song {
  const cfg = getArtistConfig(row.s);
  const image = eraArtwork(row.s, row.e) || cfg?.logoUrl || '';
  const era: Era = { name: row.e, image, data: {} };
  return {
    name: row.n,
    extra: row.x,
    url: row.u,
    urls: row.u ? [row.u] : [],
    quality: row.q,
    leak_date: row.l,
    file_date: row.f,
    available_length: row.d,
    image,
    realEra: era,
    artist: cfg?.getArtistName(row.e) ?? row.s,
  } as Song;
}

function TopBar({ title, back }: { title: string; back?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 md:px-8 py-4 border-b border-white/10 shrink-0 sticky top-0 bg-black/90 backdrop-blur z-20">
      <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer transition-colors" title="Home">
        <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
      </button>
      {back && (
        <button onClick={back} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer transition-colors">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">All producers</span>
        </button>
      )}
      <h1 className="text-lg md:text-xl font-black tracking-tight ml-1 truncate">{title}</h1>
    </div>
  );
}

function Status({ text }: { text: string }) {
  return <div className="flex-1 flex items-center justify-center text-white/40 text-sm py-24 px-6 text-center">{text}</div>;
}

export function ProducersPage() {
  const { key } = useParams<{ key?: string }>();
  return key ? <ProducerDetailView producerKey={key} /> : <ProducerDirectory />;
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

function ProducerDirectory() {
  const navigate = useNavigate();
  const [producers, setProducers] = useState<ProducerSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [artist, setArtist] = useState('');
  const [sort, setSort] = useState<'songs' | 'artists' | 'az'>('songs');
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    document.title = 'Producers · unvaulted';
    fetch('/api/producers')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { producers: ProducerSummary[] }) => setProducers(d.producers))
      .catch(() => setError(true));
  }, []);

  const artistOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of producers ?? []) for (const s of Object.keys(p.a)) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) => artistLabel(a).localeCompare(artistLabel(b)));
  }, [producers]);

  const filtered = useMemo(() => {
    if (!producers) return [];
    const q = query.trim().toLowerCase();
    const list = producers.filter((p) => (!q || p.n.toLowerCase().includes(q)) && (!artist || p.a[artist]));
    const count = (p: ProducerSummary) => (artist ? p.a[artist] : p.c);
    if (sort === 'az') return [...list].sort((a, b) => a.n.localeCompare(b.n));
    if (sort === 'artists') return [...list].sort((a, b) => Object.keys(b.a).length - Object.keys(a.a).length || b.c - a.c);
    return [...list].sort((a, b) => count(b) - count(a));
  }, [producers, query, artist, sort]);

  useEffect(() => { setLimit(PAGE_SIZE); }, [query, artist, sort]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32">
      <TopBar title="Producers" />

      <div className="px-4 md:px-8 pt-6 pb-4 max-w-6xl w-full mx-auto">
        <p className="text-white/50 text-sm">
          Every producer credited on the trackers, with all the songs they made across every artist.
          {producers && <span className="text-white/30"> · {producers.length.toLocaleString()} producers</span>}
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus-within:border-white/30">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search producers…"
              className="bg-transparent outline-none text-sm flex-1 min-w-0 placeholder:text-white/30"
              autoFocus
            />
          </label>
          <select
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 cursor-pointer"
          >
            <option value="">All artists</option>
            {artistOptions.map((s) => <option key={s} value={s}>{artistLabel(s)}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 cursor-pointer"
          >
            <option value="songs">Most songs</option>
            <option value="artists">Most artists</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {error ? <Status text="Couldn't load producers. Try again in a minute." />
        : !producers ? <Status text="Indexing producer credits across every tracker…" />
        : filtered.length === 0 ? <Status text="No producers match that search." />
        : (
          <div className="px-4 md:px-8 max-w-6xl w-full mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filtered.slice(0, limit).map((p, i) => {
                const artists = Object.entries(p.a).sort((a, b) => b[1] - a[1]);
                return (
                  <button
                    key={p.k}
                    onClick={() => navigate(`/producers/${p.k}`)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] hover:border-white/15 transition-colors text-left cursor-pointer"
                  >
                    <span className="w-7 text-right text-xs font-bold text-white/25 tabular-nums shrink-0">{sort === 'az' ? '' : i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.n}</div>
                      <div className="text-[11px] text-white/40 truncate">
                        {(artist ? p.a[artist] : p.c).toLocaleString()} song{(artist ? p.a[artist] : p.c) !== 1 ? 's' : ''}
                        {' · '}{artists.length} artist{artists.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex -space-x-2 shrink-0">
                      {artists.slice(0, 4).map(([slug]) => (
                        <Img key={slug} src={artistThumb(slug)} w={64} alt={artistLabel(slug)} title={artistLabel(slug)}
                          className="w-7 h-7 rounded-full object-cover border-2 border-black bg-white/10" />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            {filtered.length > limit && (
              <div className="flex justify-center mt-6">
                <button onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                  Show more ({(filtered.length - limit).toLocaleString()} left)
                </button>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function ProducerDetailView({ producerKey }: { producerKey: string }) {
  const navigate = useNavigate();
  const audio = audioStore.useAudioState();
  const [detail, setDetail] = useState<ProducerDetail | null>(null);
  const [error, setError] = useState(false);
  const [artistFilter, setArtistFilter] = useState<string>('');
  const [playableOnly, setPlayableOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDetail(null);
    setError(false);
    setArtistFilter('');
    setExpanded(new Set());
    window.scrollTo(0, 0);
    fetch(`/api/producers/${encodeURIComponent(producerKey)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ProducerDetail) => {
        setDetail(d);
        document.title = `${d.name || 'Producer'} · Producers · unvaulted`;
      })
      .catch(() => setError(true));
  }, [producerKey]);

  const artistCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of detail?.songs ?? []) m.set(s.s, (m.get(s.s) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [detail]);

  const visible = useMemo(
    () => (detail?.songs ?? []).filter((s) => (!artistFilter || s.s === artistFilter) && (!playableOnly || isPlayable(s))),
    [detail, artistFilter, playableOnly],
  );

  // artist → era → rows, artists ordered by how much this producer did for them.
  const grouped = useMemo(() => {
    const order = new Map(artistCounts.map(([s], i) => [s, i]));
    const byArtist = new Map<string, Map<string, CreditedSong[]>>();
    for (const row of visible) {
      let eras = byArtist.get(row.s);
      if (!eras) byArtist.set(row.s, (eras = new Map()));
      let rows = eras.get(row.e);
      if (!rows) eras.set(row.e, (rows = []));
      rows.push(row);
    }
    return [...byArtist.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
  }, [visible, artistCounts]);

  // One queue of every playable visible song, in display order, so next/prev
  // walks the page top to bottom.
  const queue = useMemo(() => {
    const rows: CreditedSong[] = [];
    for (const [, eras] of grouped) for (const [, list] of eras) for (const r of list) if (isPlayable(r)) rows.push(r);
    return { rows, songs: rows.map(toSong) };
  }, [grouped]);

  const isOurQueue = audio.playlist === queue.songs && queue.songs.length > 0;
  const playingRow = isOurQueue ? queue.rows[audio.currentSongIndex] : undefined;

  const playAt = (row: CreditedSong) => {
    const i = queue.rows.indexOf(row);
    if (i < 0) return;
    if (isOurQueue && audio.currentSongIndex === i) { audioStore.togglePlay(); return; }
    void audioStore.playSongList(queue.songs, i, queue.songs[i].realEra as Era);
  };

  const playAll = (shuffle: boolean) => {
    if (!queue.songs.length) return;
    let songs = queue.songs;
    if (shuffle) {
      songs = [...songs];
      for (let i = songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songs[i], songs[j]] = [songs[j], songs[i]];
      }
    }
    void audioStore.playSongList(songs, 0, songs[0].realEra as Era);
  };

  const back = () => navigate('/producers');

  if (error) return <div className="min-h-screen bg-black text-white flex flex-col"><TopBar title="Producer" back={back} /><Status text="Couldn't load this producer." /></div>;
  if (!detail) return <div className="min-h-screen bg-black text-white flex flex-col"><TopBar title="Producer" back={back} /><Status text="Loading credits…" /></div>;
  if (detail.songs.length === 0) return <div className="min-h-screen bg-black text-white flex flex-col"><TopBar title="Producer" back={back} /><Status text="No credited songs found for this producer." /></div>;

  const songCount = new Set(detail.songs.map((s) => songKey(s.n))).size;
  const eraCount = new Set(detail.songs.map((s) => `${s.s}|${s.e}`)).size;
  const playableCount = detail.songs.filter(isPlayable).length;
  const aliases = detail.aliases.filter((a) => a !== detail.name);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-40">
      <TopBar title={detail.name} back={back} />

      {/* Hero */}
      <div className="px-4 md:px-8 pt-8 pb-6 max-w-6xl w-full mx-auto">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Producer</div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight mt-1 break-words">{detail.name}</h2>
        {aliases.length > 0 && (
          <p className="text-white/40 text-xs mt-2">Also credited as {aliases.slice(0, 6).join(', ')}</p>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm">
          <Stat icon={<ListMusic className="w-4 h-4" />} value={songCount} label="songs" />
          <Stat icon={<Layers className="w-4 h-4" />} value={detail.songs.length} label="versions" />
          <Stat icon={<Users className="w-4 h-4" />} value={artistCounts.length} label="artists" />
          <Stat icon={<Disc3 className="w-4 h-4" />} value={eraCount} label="eras" />
          <Stat icon={<Play className="w-4 h-4" />} value={playableCount} label="playable" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          <button onClick={() => playAll(false)} disabled={!queue.songs.length}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-black text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: ACCENT }}>
            <Play className="w-4 h-4 fill-black" /> Play all
          </button>
          <button onClick={() => playAll(true)} disabled={!queue.songs.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm bg-white/10 hover:bg-white/15 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>
          <label className="flex items-center gap-2 text-xs text-white/60 ml-1 cursor-pointer select-none">
            <input type="checkbox" checked={playableOnly} onChange={(e) => setPlayableOnly(e.target.checked)} className="accent-amber-500" />
            Playable only
          </label>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Artist filter */}
        {artistCounts.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip active={!artistFilter} onClick={() => setArtistFilter('')}>All · {detail.songs.length}</Chip>
            {artistCounts.map(([slug, c]) => (
              <Chip key={slug} active={artistFilter === slug} onClick={() => setArtistFilter(artistFilter === slug ? '' : slug)}>
                <Img src={artistThumb(slug)} w={48} alt="" className="w-5 h-5 rounded-full object-cover bg-white/10" />
                {artistLabel(slug)} · {c}
              </Chip>
            ))}
          </div>
        )}

        {/* Frequent collaborators */}
        {detail.collaborators.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Often works with</h3>
            <div className="flex flex-wrap gap-2">
              {detail.collaborators.map((c) => (
                <Link key={c.k} to={`/producers/${c.k}`}
                  className="px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-colors">
                  {c.n} <span className="text-white/30">· {c.c}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {grouped.length === 0 && <Status text="No playable songs with the current filters." />}

        {/* Songs by artist → era */}
        {grouped.map(([slug, eras]) => {
          // Trim to ARTIST_ROW_CAP rows (whole eras first, then a partial one)
          // unless this artist is expanded or the only one shown.
          const total = [...eras.values()].reduce((n, r) => n + r.length, 0);
          const capped = !expanded.has(slug) && !artistFilter && total > ARTIST_ROW_CAP;
          let budget = capped ? ARTIST_ROW_CAP : Infinity;
          const shown: [string, CreditedSong[]][] = [];
          for (const [eraName, rows] of eras) {
            if (budget <= 0) break;
            shown.push([eraName, rows.slice(0, budget)]);
            budget -= rows.length;
          }
          return (
          <section key={slug}>
            <div className="flex items-center gap-3 mb-3">
              <Img src={artistThumb(slug)} w={96} alt="" className="w-9 h-9 rounded-full object-cover bg-white/10" />
              <h3 className="text-xl font-black tracking-tight">{artistLabel(slug)}</h3>
              <Link to={`/${slug}`} className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1 ml-auto">
                Open tracker <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-4">
              {shown.map(([eraName, rows]) => (
                <div key={eraName} className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <Link to={`/${slug}/album/${createSlug(eraName)}`}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                    <Img src={eraArtwork(slug, eraName) || getArtistConfig(slug)?.logoUrl} w={96} alt=""
                      className="w-10 h-10 rounded object-cover bg-white/10 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{eraName}</div>
                      <div className="text-[11px] text-white/40">{eras.get(eraName)!.length} song{eras.get(eraName)!.length !== 1 ? 's' : ''}</div>
                    </div>
                  </Link>
                  <ul>
                    {rows.map((row, i) => {
                      const playable = isPlayable(row);
                      const current = playingRow === row;
                      return (
                        <li key={`${row.n}-${i}`}
                          className={`flex items-center gap-3 px-3 py-2 ${current ? 'bg-amber-500/10' : 'hover:bg-white/[0.04]'} transition-colors`}>
                          <button onClick={() => playAt(row)} disabled={!playable}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/5 hover:bg-white/15 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                            title={playable ? 'Play' : 'Not playable here'}>
                            {current && audio.isPlaying
                              ? <Pause className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                              : <Play className="w-3.5 h-3.5" style={current ? { color: ACCENT } : undefined} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm truncate ${current ? 'font-semibold' : ''}`} style={current ? { color: ACCENT } : undefined}>{row.n}</div>
                            {row.x && <div className="text-[11px] text-white/40 truncate">{row.x.replace(/\n+/g, ' ')}</div>}
                          </div>
                          <div className="hidden sm:flex items-center gap-2 shrink-0 text-[11px] text-white/40">
                            {row.d && <span className="px-1.5 py-0.5 rounded bg-white/5">{row.d}</span>}
                            {row.q && <span className="hidden md:inline">{row.q}</span>}
                            {row.l && <span className="w-24 text-right tabular-nums">{row.l}</span>}
                          </div>
                          {playable && row.u && (
                            <AddToPlaylistButton song={toSong(row)} eraName={row.e} url={row.u} tracker={row.s} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {capped && (
              <button onClick={() => setExpanded((prev) => new Set(prev).add(slug))}
                className="mt-3 w-full py-2.5 rounded-xl text-sm text-white/60 hover:text-white bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] cursor-pointer transition-colors">
                Show all {total.toLocaleString()} for {artistLabel(slug)}
              </button>
            )}
          </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-white/60">
      <span className="text-white/30">{icon}</span>
      <span className="font-bold text-white tabular-nums">{value.toLocaleString()}</span> {label}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer whitespace-nowrap ${
        active ? 'border-amber-500/60 bg-amber-500/15 text-amber-300' : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/30'
      }`}>
      {children}
    </button>
  );
}
