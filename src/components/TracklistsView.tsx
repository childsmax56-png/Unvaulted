import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, ExternalLink, Play, Pause, Image as ImageIcon, X } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Era, Song } from '../types';
import { isSongNotAvailable, embedID3Tags, CUSTOM_IMAGES, ALBUM_RELEASE_DATES, buildArtistTag, buildTitleTag, buildDownloadName, sanitizeFilename, runWithConcurrencyLimit } from '../utils';
import { useDownloadManager } from '../DownloadManagerContext';
import { useSettings } from '../SettingsContext';
import { CommentButton } from './CommentButton';
import { makeEntryKey, makeEraKey, baseEraName } from '../comments';
import { activeConfig } from '../artists/activeConfig';

export interface TracklistTrack {
  num: string;
  name: string;
  color?: string;      // availability swatch, when the sheet colours this track
  colorLabel?: string; // legend label for that swatch
}

export interface TracklistAlbum {
  era: string;
  name: string;
  date: string;
  quality: string;
  source: string;
  links: string[];
  tracks: TracklistTrack[];
  description?: string;   // prose that precedes the numbered tracklist
  availability?: string;  // free-text availability/status from the sheet
  availColor?: string;    // per-album availability swatch (hex)
  availLabel?: string;    // legend label for that swatch
  images?: string[];      // backup tracklist screenshots pulled from the sheet
}

export interface TracklistLegendItem {
  label: string;
  color: string; // hex, may be '' when the sheet didn't expose a colour
}

interface TracklistsViewProps {
  data: TracklistAlbum[];
  legend?: TracklistLegendItem[];
  searchQuery: string;
  eras: Era[];
  onPlaySong: (song: Song, era: Era, contextTracks?: Song[]) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
  era?: Era;
  onBack?: () => void;
}

const QUALITY_COLORS: Record<string, string> = {
  Clear: 'text-emerald-400',
  'Not Clear': 'text-red-400',
  Secondary: 'text-yellow-400',
};

function qualityColor(q: string) {
  if (!q) return 'text-white/40';
  for (const [k, v] of Object.entries(QUALITY_COLORS)) {
    if (q.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return 'text-white/40';
}

const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

function normalizeName(s: string): string {
  return s
    .replace(EMOJI_RE, '')
    .replace(/️/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\(ft\..*?\)/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.startsWith(a)) return true;
  if (b.length >= 5 && a.startsWith(b)) return true;
  // Also match when one name is a substring of the other (catches "Early - Song Name" etc.)
  if (a.length >= 6 && b.includes(a)) return true;
  if (b.length >= 6 && a.includes(b)) return true;
  return false;
}

interface SongMatch { song: Song; era: Era; category: string }

// ⭐ = Best Of, ✨ = Special — these emoji prefix song names across all trackers
const PREFERRED_EMOJIS = ['⭐', '✨'];

function isPreferredSong(song: Song): boolean {
  const name = song.name || '';
  return PREFERRED_EMOJIS.some(e => name.includes(e));
}

interface SongIndexes {
  // era key → songs in that era (playable only), preferred categories first
  byEra: Map<string, SongMatch[]>;
  // exact normalized name → best playable match (preferred > first)
  byName: Map<string, SongMatch>;
}

function buildIndexes(eras: Era[]): SongIndexes {
  const byEra = new Map<string, SongMatch[]>();
  const byName = new Map<string, SongMatch>();

  for (const era of eras) {
    const eraKey = normalizeName(era.name);
    const eraMatches: SongMatch[] = [];

    for (const [category, songs] of Object.entries(era.data || {})) {
      for (const song of songs as Song[]) {
        const rawUrl = song.url || (song.urls?.[0]) || '';
        if (isSongNotAvailable(song, rawUrl) || !rawUrl) continue;

        const match: SongMatch = { song, era, category };
        eraMatches.push(match);

        const normSong = normalizeName(song.name);
        if (normSong) {
          const existing = byName.get(normSong);
          // Prefer Best Of (⭐) / Special (✨) over whatever was stored first
          if (!existing || (!isPreferredSong(existing.song) && isPreferredSong(song))) {
            byName.set(normSong, match);
          }
        }
      }
    }

    // Sort so preferred songs come first within each era
    eraMatches.sort((a, b) => {
      const ap = isPreferredSong(a.song) ? 0 : 1;
      const bp = isPreferredSong(b.song) ? 0 : 1;
      return ap - bp;
    });

    if (eraMatches.length) byEra.set(eraKey, eraMatches);
  }

  return { byEra, byName };
}

function findMatch(trackName: string, albumEra: string, idx: SongIndexes): SongMatch | null {
  const normTrack = normalizeName(trackName);
  if (!normTrack) return null;

  // Search only within the matching era — preferred (⭐/✨) songs sorted first
  const eraCandidates = idx.byEra.get(normalizeName(albumEra)) || [];
  for (const c of eraCandidates) {
    if (namesMatch(normTrack, normalizeName(c.song.name))) return c;
  }

  return null;
}

// Pre-compute matches for every track in every album — runs once when eras load
function precomputeMatches(
  data: TracklistAlbum[],
  idx: SongIndexes
): Map<number, (SongMatch | null)[]> {
  const result = new Map<number, (SongMatch | null)[]>();
  for (let ai = 0; ai < data.length; ai++) {
    const album = data[ai];
    result.set(ai, album.tracks.map(t => findMatch(t.name, album.era, idx)));
  }
  return result;
}

// ── AlbumCard ────────────────────────────────────────────────────────────────

interface AlbumCardProps {
  album: TracklistAlbum;
  matches: (SongMatch | null)[];
  defaultOpen: boolean;
  onPlaySong: (song: Song, era: Era, contextTracks?: Song[]) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
  onOpenImage: (images: string[], index: number) => void;
  legendOrder: string[];
}

async function resolveAudioUrl(rawUrl: string): Promise<string> {
  if (rawUrl.includes('imgur.gg/f/')) {
    const id = rawUrl.split('/f/')[1];
    const host = new URL(rawUrl).host;
    const res = await fetch(`https://${host}/api/file/${id}`);
    const data = await res.json();
    return data.cdnUrl as string;
  }
  if (rawUrl.includes('pillows.su/f/')) {
    const id = rawUrl.split('/f/')[1];
    return `https://api.pillows.su/api/get/${id}`;
  }
  if (rawUrl.includes('krakenfiles.com/view/')) {
    return `/api/kraken-proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

function AlbumCard({ album, matches, defaultOpen, onPlaySong, currentSong, isPlaying, onOpenImage, legendOrder }: AlbumCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [dlProgress, setDlProgress] = useState<string | null>(null);
  const { settings } = useSettings();
  const { startJob, updateJob, startItem, finishItem, finishJob } = useDownloadManager();

  const playableSongs = useMemo(
    () => matches.filter((m): m is SongMatch => m !== null).map(m => m.song),
    [matches]
  );

  // Per-colour track counts, in legend order, for the header availability bar.
  const availSegments = useMemo(() => {
    const counts = new Map<string, { color: string; label: string; count: number }>();
    for (const t of album.tracks) {
      if (!t.color) continue;
      const seg = counts.get(t.color) ?? { color: t.color, label: t.colorLabel || '', count: 0 };
      seg.count++;
      counts.set(t.color, seg);
    }
    const order = legendOrder.map(c => c.toLowerCase());
    return [...counts.values()].sort((a, b) => order.indexOf(a.color.toLowerCase()) - order.indexOf(b.color.toLowerCase()));
  }, [album.tracks, legendOrder]);

  const handlePlay = useCallback((match: SongMatch) => {
    onPlaySong(match.song, match.era, playableSongs);
  }, [onPlaySong, playableSongs]);

  const handleDownloadZip = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dlProgress) return;

    const playable = album.tracks
      .map((track, i) => ({ track, match: matches[i] }))
      .filter((x): x is { track: typeof x.track; match: SongMatch } => x.match !== null);

    if (!playable.length) return;

    setDlProgress(`0 / ${playable.length}`);
    const jobId = startJob(album.name, playable.length);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let done = 0;

    await runWithConcurrencyLimit(playable, async ({ track, match }) => {
      try {
        const rawUrl = match.song.url || match.song.urls?.[0] || '';
        const fetchUrl = await resolveAudioUrl(rawUrl);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('fetch failed');
        let blob = await res.blob();
        const ext = blob.type.includes('wav') ? '.wav' : blob.type.includes('flac') ? '.flac' : '.mp3';
        if (ext === '.mp3' && settings.embedMetadata) {
          try {
            const artworkUrl = CUSTOM_IMAGES[album.era] || match.era?.image || match.song.image;
            const year = album.date || ALBUM_RELEASE_DATES[album.era]?.split('/').pop();
            blob = await embedID3Tags(blob, {
              title: buildTitleTag(track.name, settings.tagFeaturedArtists),
              artist: buildArtistTag(track.name, album.era, settings.tagFeaturedArtists),
              album: album.name,
              year,
              artworkUrl,
            }, track.name);
          } catch {
            // continue without tags
          }
        }
        const num = track.num !== '#?' ? String(track.num).padStart(2, '0') : '00';
        zip.file(`${num}. ${sanitizeFilename(buildDownloadName(track.name, settings.tagFeaturedArtists, settings.tagsAsEmojis))}${ext}`, blob);
      } catch {
        // skip tracks that fail
      } finally {
        done++;
        setDlProgress(`${done} / ${playable.length}`);
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), ({ track }) => startItem(jobId, track.name), ({ track }) => finishItem(jobId, track.name));

    const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    saveAs(content, `${sanitizeFilename(album.name)}.zip`);
    finishJob(jobId, 'done');
    setDlProgress(null);
  }, [album, matches, dlProgress]);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        {album.images && album.images.length > 0 && (
          <img
            src={album.images[0]}
            loading="lazy"
            alt=""
            className="w-10 h-10 rounded-md object-cover shrink-0 border border-white/10"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">{album.name}</p>
          <p className="text-white/40 text-xs mt-0.5 truncate">
            {album.era}{album.date ? ` · ${album.date}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {album.availColor ? (
            <span
              className="text-[11px] font-medium hidden sm:inline-flex items-center gap-1.5"
              style={{ color: album.availColor }}
              title={album.availLabel || album.availability}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: album.availColor }} />
              {album.availability || album.availLabel || album.quality || '—'}
            </span>
          ) : (
            <span className={`text-[11px] font-medium hidden sm:inline ${qualityColor(album.availability || album.quality)}`}>
              {album.availability || album.quality || '—'}
            </span>
          )}
          {availSegments.length > 0 && (
            <span
              className="flex w-10 sm:w-16 h-1.5 rounded-full overflow-hidden bg-white/10"
              title={availSegments.map(sg => `${sg.count} × ${sg.label}`).join('\n')}
            >
              {availSegments.map(sg => (
                <span key={sg.color} style={{ backgroundColor: sg.color, width: `${(sg.count / album.tracks.length) * 100}%` }} />
              ))}
            </span>
          )}
          {album.images && album.images.length > 1 && (
            <span className="text-white/30 hidden sm:inline-flex items-center gap-0.5" title={`${album.images.length} images`}>
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="text-[10px]">{album.images.length}</span>
            </span>
          )}
          <span className="text-white/30 text-xs hidden md:inline">
            {playableSongs.length}/{album.tracks.length}
          </span>
          {album.links[0] && (
            <a
              href={album.links[0]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-white/30 hover:text-[var(--theme-color)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={handleDownloadZip}
            title={playableSongs.length === 0 ? 'No playable songs' : 'Download songs as ZIP'}
            disabled={playableSongs.length === 0}
            className={`flex items-center gap-1 transition-colors cursor-pointer ${dlProgress ? 'text-[var(--theme-color)]' : playableSongs.length === 0 ? 'text-white/15 cursor-not-allowed' : 'text-white/30 hover:text-[var(--theme-color)]'}`}
          >
            {dlProgress
              ? <span className="text-[10px] font-mono tabular-nums">{dlProgress}</span>
              : <Download className="w-3.5 h-3.5" />}
          </button>
          <CommentButton
            tracker={activeConfig.slug}
            entryKey={makeEntryKey('Tracklist', album.era, album.name)}
            entryLabel={album.name}
            entryType="Tracklist"
          />
          {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="tracks"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05]">
              {album.description && (
                <p className="px-4 pt-3 pb-3 text-white/60 text-xs leading-relaxed whitespace-pre-line border-b border-white/[0.05]">
                  {album.description}
                </p>
              )}
              <div className={album.images?.length ? 'md:grid md:grid-cols-[minmax(0,1fr)_240px]' : ''}>
              {album.images && album.images.length > 0 && (
                <div className="md:order-2 md:border-l border-b md:border-b-0 border-white/[0.05] p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
                  {album.images.map((src, ii) => (
                    <button
                      key={ii}
                      onClick={e => { e.stopPropagation(); onOpenImage(album.images!, ii); }}
                      className="group/img relative shrink-0 rounded-lg overflow-hidden border border-white/10 hover:border-[var(--theme-color)]/50 transition-colors cursor-zoom-in md:sticky md:top-20"
                      title="View full image"
                    >
                      <img
                        src={src}
                        loading="lazy"
                        alt={`${album.name} tracklist image`}
                        className="h-40 md:h-auto w-auto md:w-full object-contain block bg-black/30"
                      />
                      <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
              <div className="divide-y divide-white/[0.04] md:order-1 min-w-0">
              {album.tracks.length === 0 ? (
                <p className="px-4 py-3 text-xs text-white/30 italic">
                  {album.description ? 'Tracklist not itemised — see description above.' : 'No parsed tracks'}
                </p>
              ) : album.tracks.map((t, i) => {
                const match = matches[i] ?? null;
                const rawUrl = match ? (match.song.url || match.song.urls?.[0] || '') : '';
                const isCurrentlyPlaying =
                  isPlaying && currentSong && match &&
                  currentSong.name === match.song.name &&
                  (currentSong.url || currentSong.urls?.[0] || '') === rawUrl;

                return (
                  <div
                    key={i}
                    onClick={() => match && handlePlay(match)}
                    className={`flex items-center gap-3 px-4 py-2 transition-colors group
                      ${match ? 'hover:bg-white/[0.05] cursor-pointer' : 'cursor-default'}
                      ${isCurrentlyPlaying ? 'bg-white/[0.06]' : ''}`}
                  >
                    <span className="text-white/25 text-xs w-6 text-right shrink-0 font-mono relative">
                      {match ? (
                        <>
                          <span className={`transition-opacity ${isCurrentlyPlaying ? 'opacity-0' : 'group-hover:opacity-0'}`}>
                            {t.num === '#?' ? '?' : t.num}
                          </span>
                          <span className={`absolute inset-0 flex items-center justify-end transition-opacity
                            ${isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {isCurrentlyPlaying
                              ? <Pause className="w-3 h-3 text-[var(--theme-color)]" />
                              : <Play className="w-3 h-3 text-[var(--theme-color)]" />}
                          </span>
                        </>
                      ) : (
                        <span className="opacity-40">{t.num === '#?' ? '?' : t.num}</span>
                      )}
                    </span>

                    <span
                      className={`text-sm leading-snug flex-1 min-w-0 truncate transition-colors
                        ${isCurrentlyPlaying
                          ? 'text-[var(--theme-color)] font-medium'
                          : t.color
                          ? match ? 'group-hover:brightness-125' : 'opacity-70'
                          : match
                          ? 'text-white/80 group-hover:text-white'
                          : 'text-white/30'}`}
                      style={t.color && !isCurrentlyPlaying ? { color: t.color } : undefined}
                      title={t.colorLabel}
                    >
                      {t.name}
                    </span>

                    {t.colorLabel && (
                      <span className="text-[10px] text-white/30 hidden lg:inline truncate max-w-[160px] opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.colorLabel}
                      </span>
                    )}

                    {match && match.era.name !== album.era && (
                      <span className="text-[10px] text-white/20 hidden md:inline truncate max-w-[120px]">
                        {match.era.name}
                      </span>
                    )}
                  </div>
                );
              })}
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

export function TracklistsView({ data, legend = [], searchQuery, eras, onPlaySong, currentSong, isPlaying, era, onBack }: TracklistsViewProps) {
  const q = searchQuery.toLowerCase().trim();
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const openImage = useCallback((images: string[], index: number) => setLightbox({ images, index }), []);
  const stepImage = useCallback((dir: number) => setLightbox(lb => lb && {
    ...lb, index: (lb.index + dir + lb.images.length) % lb.images.length,
  }), []);

  // Only show the colour key when the sheet actually exposed swatch colours and
  // at least one album/track is coloured with them.
  const colouredLegend = useMemo(() => legend.filter(l => l.color), [legend]);
  const legendOrder = useMemo(() => colouredLegend.map(l => l.color), [colouredLegend]);
  // How many tracks carry each swatch, shown next to the legend labels.
  const legendCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of data) for (const t of a.tracks) {
      if (t.color) counts.set(t.color.toLowerCase(), (counts.get(t.color.toLowerCase()) ?? 0) + 1);
    }
    return counts;
  }, [data]);
  const hasColouredData = useMemo(
    () => data.some(a => a.availColor || a.tracks.some(t => t.color)),
    [data]
  );

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') stepImage(1);
      else if (e.key === 'ArrowLeft') stepImage(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, stepImage]);

  // Build indexes once when eras are ready
  const idx = useMemo(() => buildIndexes(eras), [eras]);

  // Pre-compute ALL matches once — O(albums × tracks) but only runs when eras/data change
  const allMatches = useMemo(() => precomputeMatches(data, idx), [data, idx]);

  // Filter albums
  const filtered = useMemo(() => {
    if (!q) return data.map((album, i) => ({ album, origIdx: i }));
    return data
      .map((album, i) => ({ album, origIdx: i }))
      .filter(({ album, origIdx }) => {
        if (album.name.toLowerCase().includes(q)) return true;
        if (album.era.toLowerCase().includes(q)) return true;
        if (album.date.toLowerCase().includes(q)) return true;
        if (album.tracks.some(t => t.name.toLowerCase().includes(q))) return true;
        // also match if a song's actual name in db matches
        const matches = allMatches.get(origIdx) || [];
        if (matches.some(m => m && m.song.name.toLowerCase().includes(q))) return true;
        return false;
      });
  }, [data, allMatches, q]);

  // Group by era
  const grouped = useMemo(() => {
    const map = new Map<string, { album: TracklistAlbum; origIdx: number }[]>();
    for (const item of filtered) {
      const key = item.album.era || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filtered]);

  // Flatten grouped for pagination
  const flatItems = useMemo(() => {
    const items: ({ type: 'era'; era: string } | { type: 'album'; album: TracklistAlbum; origIdx: number })[] = [];
    for (const [era, albums] of grouped.entries()) {
      items.push({ type: 'era', era });
      for (const a of albums) items.push({ type: 'album', ...a });
    }
    return items;
  }, [grouped]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Reset pagination when search changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [q]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(n => n + PAGE_SIZE);
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [flatItems]);

  const totalPlayable = useMemo(() =>
    Array.from(allMatches.values()).reduce((sum, ms) => sum + ms.filter(Boolean).length, 0),
    [allMatches]
  );

  const visibleFlat = flatItems.slice(0, visibleCount);

  return (
    <motion.div
      key="tracklists"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="px-4 md:px-8 py-6 max-w-4xl mx-auto w-full"
    >
      {onBack && era && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-white font-display font-bold text-xl tracking-tight">
            {era ? era.name : 'Album Copies'}
          </h2>
          {era && (
            <CommentButton
              tracker={activeConfig.slug}
              entryKey={makeEraKey(era.name)}
              entryLabel={baseEraName(era.name)}
              entryType="Era"
              variant="pill"
            />
          )}
        </div>
        <p className="text-white/40 text-xs mt-1">
          {filtered.length} album{filtered.length !== 1 ? 's' : ''} ·{' '}
          {filtered.reduce((s, { album }) => s + album.tracks.length, 0).toLocaleString()} tracks ·{' '}
          <span className="text-[var(--theme-color)]/70">{totalPlayable.toLocaleString()} playable</span>
        </p>
      </div>

      {colouredLegend.length > 0 && hasColouredData && (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2">
          <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Availability</span>
          {colouredLegend.map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              <span style={{ color: l.color }}>{l.label}</span>
              {legendCounts.get(l.color.toLowerCase()) ? (
                <span className="text-white/30 tabular-nums">{legendCounts.get(l.color.toLowerCase())!.toLocaleString()}</span>
              ) : null}
            </span>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30 text-sm">No results for "{searchQuery}"</div>
      ) : (
        <div className="space-y-2">
          {visibleFlat.map((item, i) =>
            item.type === 'era' ? (
              <h3
                key={`era-${item.era}-${i}`}
                className="text-[var(--theme-color)] text-xs font-bold uppercase tracking-widest pt-4 pb-1 px-1 first:pt-0"
              >
                {item.era}
              </h3>
            ) : (
              <AlbumCard
                key={`${item.album.name}-${item.origIdx}`}
                album={item.album}
                matches={allMatches.get(item.origIdx) ?? []}
                defaultOpen={q.length > 0}
                onPlaySong={onPlaySong}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onOpenImage={openImage}
                legendOrder={legendOrder}
              />
            )
          )}
          <div ref={loaderRef} className="h-4" />
        </div>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightbox.images[lightbox.index]}
              alt="Tracklist image"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            {lightbox.images.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); stepImage(-1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/70 hover:text-white cursor-pointer"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); stepImage(1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/70 hover:text-white cursor-pointer"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 tabular-nums">
                  {lightbox.index + 1} / {lightbox.images.length}
                </span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
