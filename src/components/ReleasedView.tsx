import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp, Play } from 'lucide-react';
import {
  SiSpotify,
  SiYoutube,
  SiSoundcloud,
  SiApplemusic,
  SiTidal,
  SiBandcamp,
} from 'react-icons/si';
import { Era, Song } from '../types';
import { CUSTOM_IMAGES, ALBUM_DESCRIPTIONS , Img} from '../utils';
import { useIsClamped } from '../hooks/useIsClamped';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { CommentButton } from './CommentButton';
import { makeEntryKey, makeEraKey, baseEraName } from '../comments';
import { activeConfig } from '../artists/activeConfig';

export interface ReleasedEntry {
  Era: string;
  Name: string;
  Notes: string;
  Length: string;
  'Release Date': string;
  Type: string;
  Streaming: string;
  'Link(s)': string;
  // Some trackers' Released tabs use the live sheet's raw header names instead of the
  // committed-CSV ones (e.g. the pushagold sheet): "Links"/"Link" for the links column,
  // "Track Length" for Length, and "Release\nDate" for Release Date. Read all as fallbacks.
  Links?: string;
  Link?: string;
  'Track Length'?: string;
  'Release\nDate'?: string;
}

interface ReleasedViewProps {
  eras: Era[];
  releasedData: ReleasedEntry[];
  searchQuery: string;
  spotifyLoggedIn?: boolean;
  spotifyReady?: boolean;
  onPlaySpotify?: (uri: string) => void;
  youtubeReady?: boolean;
  onPlayYoutube?: (videoId: string, title?: string) => void;
  onPlayAudio?: (url: string, name: string, eraName: string, length?: string) => void;
  soundcloudReady?: boolean;
  onPlaySoundCloud?: (url: string) => void;
  onPlayArchive?: (archiveId: string, title: string, eraName: string) => void;
  onEmbed?: () => void;
}

// ─── embed helpers ───────────────────────────────────────────────────────────

type Platform = 'spotify' | 'youtube' | 'soundcloud' | 'apple' | 'tidal' | 'bandcamp' | 'archive' | 'audio' | 'other';

interface LinkInfo {
  platform: Platform;
  url: string;
  embedUrl?: string;
  label: string;
}

function parseLinkInfo(raw: string): LinkInfo {
  const u = raw.trim();

  if (u.includes('open.spotify.com')) {
    const m = u.match(/open\.spotify\.com(?:\/intl-[a-z]+)?\/(track|album|playlist)\/([A-Za-z0-9]+)/);
    if (m) {
      return {
        platform: 'spotify',
        url: u,
        embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`,
        label: 'Spotify',
      };
    }
  }

  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    let id: string | null = null;
    const m1 = u.match(/[?&]v=([A-Za-z0-9_-]+)/);
    const m2 = u.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    id = m1?.[1] ?? m2?.[1] ?? null;
    if (id) {
      return {
        platform: 'youtube',
        url: u,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        label: 'YouTube',
      };
    }
  }

  if (u.includes('soundcloud.com') || u.includes('on.soundcloud.com')) {
    return {
      platform: 'soundcloud',
      url: u,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false`,
      label: 'SoundCloud',
    };
  }

  if (u.includes('music.apple.com')) {
    const embedUrl = u.replace('https://music.apple.com/', 'https://embed.music.apple.com/');
    return { platform: 'apple', url: u, embedUrl, label: 'Apple Music' };
  }

  if (u.includes('pillows.su/f/') || u.includes('imgur.gg/f/') || u.includes('i.imgur.com') || u.includes('krakenfiles.com/view/') || u.includes('pixeldrain.com/u/')) {
    return { platform: 'audio', url: u, label: 'Play' };
  }

  if (u.includes('tidal.com')) {
    return { platform: 'tidal', url: u, label: 'Tidal' };
  }

  if (u.includes('bandcamp.com')) {
    return { platform: 'bandcamp', url: u, label: 'Bandcamp' };
  }

  if (u.includes('archive.org/details/')) {
    const id = u.split('archive.org/details/')[1].split('?')[0];
    return {
      platform: 'archive',
      url: u,
      embedUrl: `https://archive.org/embed/${id}`,
      label: 'Archive.org',
    };
  }

  return { platform: 'other', url: u, label: 'Link' };
}

function parseLinks(raw: string): LinkInfo[] {
  return raw
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('http'))
    .map(parseLinkInfo);
}

function embedHeight(info: LinkInfo): number {
  if (info.platform === 'youtube') return 220;
  if (info.platform === 'spotify') {
    // albums are taller
    return info.embedUrl?.includes('/album/') || info.embedUrl?.includes('/playlist/') ? 352 : 152;
  }
  if (info.platform === 'soundcloud') return 166;
  if (info.platform === 'apple') return 175;
  if (info.platform === 'archive') return 150;
  return 150;
}

// ─── platform icon + color ────────────────────────────────────────────────────

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const cls = className ?? 'w-3.5 h-3.5';
  switch (platform) {
    case 'spotify':    return <SiSpotify className={cls} />;
    case 'youtube':    return <SiYoutube className={cls} />;
    case 'soundcloud': return <SiSoundcloud className={cls} />;
    case 'apple':      return <SiApplemusic className={cls} />;
    case 'tidal':      return <SiTidal className={cls} />;
    case 'bandcamp':   return <SiBandcamp className={cls} />;
    case 'audio':      return <Play className={cls} />;
    default:           return <ExternalLink className={cls} />;
  }
}

const PLATFORM_COLOR: Record<Platform, string> = {
  spotify:    '#1DB954',
  youtube:    '#FF0000',
  soundcloud: '#FF5500',
  apple:      '#FA243C',
  tidal:      '#00FFFF',
  bandcamp:   '#1DA0C3',
  archive:    '#739AC5',
  audio:      '#ffffff',
  other:      '#888888',
};

// ─── type badge color ─────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  'Single':      'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  'Album Track': 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  'Feature':     'border-purple-500/30 text-purple-400 bg-purple-500/10',
  'Production':  'border-green-500/30 text-green-400 bg-green-500/10',
  'Other':       'border-white/20 text-white/50 bg-white/5',
};

// ─── group released data by era ───────────────────────────────────────────────

interface ReleasedEraGroup {
  eraName: string;
  image?: string;
  tracks: ReleasedEntry[];
}

function groupByEra(data: ReleasedEntry[], allEras: Era[]): ReleasedEraGroup[] {
  const order: string[] = [];
  const map: Record<string, ReleasedEntry[]> = {};

  for (const entry of data) {
    const era = entry.Era?.trim();
    if (!era) continue;
    // Skip section-header/stats-banner rows (e.g. "13 Full\n5 Tagged\n...") that some
    // sheets (jayzgold) place above each album's songs instead of a real song row.
    if (era.includes('\n')) continue;
    // Same banner pattern, but as a single-line count (e.g. chrisbrowngold's
    // "20 Mixtape Tracks") — these also carry no Type/Link data, unlike a real song row.
    const links = entry['Link(s)'] ?? entry.Links ?? entry.Link ?? '';
    if (/^\d+\s/.test(era) && !entry.Type?.trim() && !links.trim()) continue;
    if (!map[era]) {
      map[era] = [];
      order.push(era);
    }
    map[era].push(entry);
  }

  return order.map(name => {
    const matchingEra = allEras.find(e => e.name === name);
    return {
      eraName: name,
      image: CUSTOM_IMAGES[name] ?? matchingEra?.image,
      tracks: map[name],
    };
  });
}

// ─── main component ───────────────────────────────────────────────────────────

export function ReleasedView({ eras, releasedData, searchQuery, spotifyLoggedIn, spotifyReady, onPlaySpotify, youtubeReady, onPlayYoutube, onPlayAudio, soundcloudReady, onPlaySoundCloud, onPlayArchive, onEmbed }: ReleasedViewProps) {
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [descRef, isDescClamped] = useIsClamped<HTMLParagraphElement>(selectedEra, isDescExpanded);
  useEffect(() => { setIsDescExpanded(false); }, [selectedEra]);
  // key: `${trackIdx}-${linkIdx}`
  const [openEmbed, setOpenEmbed] = useState<string | null>(null);

  const groups = useMemo(() => groupByEra(releasedData, eras), [releasedData, eras]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups
      .map(g => ({
        ...g,
        tracks: g.tracks.filter(
          t =>
            t.Name.toLowerCase().includes(q) ||
            t.Notes.toLowerCase().includes(q) ||
            g.eraName.toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.tracks.length > 0 || g.eraName.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const selectedGroup = useMemo(
    () => groups.find(g => g.eraName === selectedEra) ?? null,
    [groups, selectedEra],
  );

  const filteredTracks = useMemo(() => {
    if (!selectedGroup) return [];
    if (!searchQuery) return selectedGroup.tracks;
    const q = searchQuery.toLowerCase();
    return selectedGroup.tracks.filter(
      t => t.Name.toLowerCase().includes(q) || t.Notes.toLowerCase().includes(q),
    );
  }, [selectedGroup, searchQuery]);

  // ── era detail view ─────────────────────────────────────────────────────────
  if (selectedGroup) {
    return (
      <motion.div
        key="released-detail"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto custom-scrollbar pb-64"
      >
        {/* header */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
          <button
            onClick={() => { setSelectedEra(null); setOpenEmbed(null); setIsDescExpanded(false); }}
            className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl">
            {selectedGroup.image ? (
              <Img w={400} eager src={selectedGroup.image} alt={selectedGroup.eraName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">
                {selectedGroup.eraName}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-end h-full py-2">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                {selectedGroup.eraName}
              </h1>
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                Released
              </span>
              <CommentButton
                tracker={activeConfig.slug}
                entryKey={makeEraKey(selectedGroup.eraName)}
                entryLabel={baseEraName(selectedGroup.eraName)}
                entryType="Era"
                variant="pill"
              />
            </div>
            <p className="text-white/50 text-sm">
              {selectedGroup.tracks.length} track{selectedGroup.tracks.length !== 1 ? 's' : ''}
            </p>
            {ALBUM_DESCRIPTIONS[selectedGroup.eraName] && (
              <div className="mt-3 max-w-3xl">
                <p ref={descRef} className={`text-white/80 text-sm leading-relaxed ${isDescExpanded ? '' : 'line-clamp-3'}`}>
                  {ALBUM_DESCRIPTIONS[selectedGroup.eraName]}
                </p>
                {(isDescClamped || isDescExpanded) && (
                  <button
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-[var(--theme-color)] text-xs font-bold mt-1 hover:underline cursor-pointer"
                  >
                    {isDescExpanded ? 'Show Less' : 'Show More...'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* track list */}
        <div className="px-4 md:px-8 mt-6 max-w-5xl mx-auto">
          {/* column headers */}
          <div className="hidden sm:flex items-center px-4 py-2 text-xs font-semibold text-white/30 uppercase tracking-wider border-b border-white/5 mb-1">
            <div className="w-8 shrink-0">#</div>
            <div className="flex-1">Title</div>
            <div className="w-32 shrink-0 text-right pr-2">Date</div>
            <div className="w-20 shrink-0 text-right pr-2">Length</div>
            <div className="w-28 shrink-0">Type</div>
            <div className="w-48 shrink-0">Listen</div>
            <div className="w-8 shrink-0" />
          </div>

          {filteredTracks.map((track, trackIdx) => {
            const links = parseLinks(track['Link(s)'] ?? track.Links ?? track.Link ?? '');
            const nameParts = track.Name.split('\n').map(s => s.trim()).filter(Boolean);
            const mainName = nameParts[0] ?? track.Name;
            const subName = nameParts.slice(1).join(' ') || undefined;
            const trackLength = track.Length || track['Track Length'] || '';
            const releaseDate = track['Release Date'] || track['Release\nDate'] || '';

            return (
              <div key={trackIdx} className="border-b border-white/5 last:border-0">
                {/* track row */}
                <div className="flex items-center px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-8 shrink-0 text-sm font-mono text-white/30 group-hover:text-white/50">
                    {trackIdx + 1}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="font-medium text-white truncate">{mainName}</div>
                    {subName && (
                      <div className="text-xs text-white/40 truncate mt-0.5">{subName}</div>
                    )}
                    {track.Notes && (
                      <div className="text-xs text-white/30 line-clamp-1 mt-0.5 italic">{track.Notes}</div>
                    )}
                  </div>

                  <div className="w-32 shrink-0 text-right pr-2 text-xs text-white/40 hidden sm:block">
                    {releaseDate}
                  </div>

                  <div className="w-20 shrink-0 text-right pr-2 text-xs text-white/40 hidden sm:block font-mono">
                    {trackLength}
                  </div>

                  <div className="w-28 shrink-0 hidden sm:block">
                    {track.Type && (
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wider ${TYPE_COLOR[track.Type] ?? TYPE_COLOR['Other']}`}>
                        {track.Type}
                      </span>
                    )}
                  </div>

                  {/* platform buttons */}
                  <div className="w-48 shrink-0 flex items-center gap-1 flex-wrap">
                    {links.map((link, linkIdx) => {
                      const key = `${trackIdx}-${linkIdx}`;
                      const isOpen = openEmbed === key;

                      // Spotify: use SDK player if logged in (ready check is for button state, not iframe suppression)
                      const useSpotifySDK = link.platform === 'spotify' && !!spotifyLoggedIn && !!onPlaySpotify;
                      const spotifyUri = useSpotifySDK
                        ? (link.url.match(/open\.spotify\.com(?:\/intl-[a-z]+)?\/(track|album)\/([A-Za-z0-9]+)/)
                            ? `spotify:${link.url.match(/open\.spotify\.com(?:\/intl-[a-z]+)?\/(track|album)\/([A-Za-z0-9]+)/)![1]}:${link.url.match(/open\.spotify\.com(?:\/intl-[a-z]+)?\/(track|album)\/([A-Za-z0-9]+)/)![2]}`
                            : null)
                        : null;

                      // YouTube: use background player if ready
                      const ytIdMatch = link.url.match(/[?&]v=([A-Za-z0-9_-]+)/) ?? link.url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
                      const useYoutubeSDK = link.platform === 'youtube' && youtubeReady && onPlayYoutube && !!ytIdMatch;
                      const ytVideoId = ytIdMatch?.[1] ?? null;

                      const useAudioSDK = link.platform === 'audio' && !!onPlayAudio;
                      const useSoundCloudSDK = link.platform === 'soundcloud' && soundcloudReady && !!onPlaySoundCloud;
                      const archiveIdMatch = link.platform === 'archive' && link.url.includes('archive.org/details/')
                        ? link.url.split('archive.org/details/')[1].split('?')[0] : null;
                      const useArchiveSDK = !!archiveIdMatch && !!onPlayArchive;
                      const canEmbed = !useSpotifySDK && !useYoutubeSDK && !useAudioSDK && !useSoundCloudSDK && !useArchiveSDK && !!link.embedUrl;

                      return (
                        <button
                          key={linkIdx}
                          onClick={() => {
                            if (useSpotifySDK && spotifyUri) {
                              onPlaySpotify!(spotifyUri);
                            } else if (useYoutubeSDK && ytVideoId) {
                              onPlayYoutube!(ytVideoId, track.Name.split('\n')[0]);
                            } else if (useAudioSDK) {
                              onPlayAudio!(link.url, track.Name.split('\n')[0], selectedGroup.eraName, trackLength);
                            } else if (useSoundCloudSDK) {
                              onPlaySoundCloud!(link.url);
                            } else if (useArchiveSDK && archiveIdMatch) {
                              onPlayArchive!(archiveIdMatch, track.Name.split('\n')[0], selectedGroup.eraName);
                            } else if (canEmbed) {
                              if (!isOpen) onEmbed?.();
                              setOpenEmbed(isOpen ? null : key);
                            } else {
                              window.open(link.url, '_blank');
                            }
                          }}
                          title={useSpotifySDK && !spotifyReady ? 'Spotify connecting...' : useSpotifySDK ? 'Play via Spotify' : useYoutubeSDK ? 'Play via YouTube' : useAudioSDK ? 'Play' : useSoundCloudSDK ? 'Play via SoundCloud' : useArchiveSDK ? 'Play via Archive.org' : link.label}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                          style={{ color: PLATFORM_COLOR[link.platform] }}
                        >
                          <PlatformIcon platform={link.platform} className="w-3 h-3" />
                          <span className="hidden lg:inline">{link.label}</span>
                          {canEmbed && (
                            isOpen
                              ? <ChevronUp className="w-2.5 h-2.5 text-white/40" />
                              : <ChevronDown className="w-2.5 h-2.5 text-white/40" />
                          )}
                          {!canEmbed && !useSpotifySDK && !useYoutubeSDK && !useAudioSDK && !useSoundCloudSDK && !useArchiveSDK && <ExternalLink className="w-2.5 h-2.5 opacity-40" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* add to playlist + comments */}
                  <div className="shrink-0 hidden sm:flex items-center justify-end gap-1 pl-1">
                    {links.length > 0 && (
                      <AddToPlaylistButton
                        song={{ name: mainName, url: links[0].url, track_length: trackLength } as unknown as Song}
                        eraName={selectedGroup.eraName}
                        url={links[0].url}
                        isCurrentlyPlaying={false}
                      />
                    )}
                    <CommentButton
                      tracker={activeConfig.slug}
                      entryKey={makeEntryKey('Released', selectedGroup.eraName, mainName)}
                      entryLabel={mainName}
                      entryType="Released"
                    />
                  </div>
                </div>

                {/* inline embed accordion */}
                <AnimatePresence>
                  {links.map((link, linkIdx) => {
                    const key = `${trackIdx}-${linkIdx}`;
                    const ytId2 = link.url.match(/[?&]v=([A-Za-z0-9_-]+)/)?.[1] ?? link.url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)?.[1];
                    if (openEmbed !== key || !link.embedUrl) return null;
                    if (link.platform === 'youtube' && youtubeReady && onPlayYoutube && ytId2) return null;
                    if (link.platform === 'soundcloud' && soundcloudReady && onPlaySoundCloud) return null;
                    if (link.platform === 'archive' && onPlayArchive && link.url.includes('archive.org/details/')) return null;
                    const h = embedHeight(link);
                    return (
                      <motion.div
                        key={key}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: h + 16, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden px-4 pb-2"
                      >
                        <iframe
                          src={link.embedUrl}
                          width="100%"
                          height={h}
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-lg"
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // ── era grid ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      key="released-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
    >
      {filteredGroups.map((group, i) => (
        <motion.div
          key={group.eraName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
          onClick={() => { setSelectedEra(group.eraName); setIsDescExpanded(false); }}
          className="group flex flex-col gap-3 cursor-pointer"
        >
          <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
            {group.image ? (
              <Img w={300}
                src={group.image}
                alt={group.eraName}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-2xl text-center p-4">
                {group.eraName}
              </div>
            )}
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
              {group.tracks.length}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:underline truncate">
              {group.eraName}
            </h3>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
