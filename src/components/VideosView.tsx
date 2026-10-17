import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp, Film, Maximize2, Minimize2, X } from 'lucide-react';
import { Era } from '../types';
import { createSlug, CUSTOM_IMAGES , Img, relPath, absPath, pixeldrainProxyBase} from '../utils';
import { useSettings } from '../SettingsContext';
import { CommentButton } from './CommentButton';
import { NoteButton } from './NoteButton';
import { makeEntryKey, makeEraKey, baseEraName } from '../comments';
import { activeConfig } from '../artists/activeConfig';

export interface VideoRawEntry {
  Era: string;
  Name: string;
  Notes: string;
  Length: string;
  'Date Made': string;
  Type: string;
  'Available Length': string;
  Quality: string;
  'Link(s)': string;
}

interface VideoEntry {
  era: string;
  name: string;
  notes: string;
  length: string;
  dateMade: string;
  type: string;
  availableLength: string;
  quality: string;
  links: string[];
  section: 'Unreleased' | 'Released';
}

interface VideoEraGroup {
  name: string;
  image?: string;
  unreleased: VideoEntry[];
  released: VideoEntry[];
  total: number;
}

interface MiniPlayerState {
  entry: VideoEntry;
  linkIndex: number;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractDriveId(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractPillowId(url: string): string | null {
  const m = url.match(/pillows\.su\/f\/([a-f0-9]+)/);
  return m ? m[1] : null;
}

function extractPixeldrainId(url: string): string | null {
  // Single-file views only (/u/ and /d/); /l/ list URLs contain multiple files
  const m = url.match(/pixeldrain\.com\/(?:u|d)\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

type EmbedInfo =
  | { type: 'youtube'; src: string }
  | { type: 'drive'; src: string }
  | { type: 'pillowcase'; src: string }
  | { type: 'pixeldrain'; src: string }
  | null;

function extractDailymotionId(url: string): string | null {
  const m = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function getEmbedInfo(links: string[]): EmbedInfo {
  for (const link of links) {
    if (link.includes('youtube.com') || link.includes('youtu.be')) {
      const id = extractYouTubeId(link);
      // Use youtube-nocookie.com to avoid embedding restrictions on many videos
      if (id) return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    }
  }
  for (const link of links) {
    if (link.includes('dailymotion.com')) {
      const id = extractDailymotionId(link);
      if (id) return { type: 'youtube', src: `https://www.dailymotion.com/embed/video/${id}` };
    }
  }
  for (const link of links) {
    if (link.includes('drive.google.com')) {
      const id = extractDriveId(link);
      if (id) return { type: 'drive', src: `https://drive.google.com/file/d/${id}/preview` };
    }
  }
  for (const link of links) {
    if (link.includes('pixeldrain.com')) {
      const id = extractPixeldrainId(link);
      // Pixeldrain blocks cross-site hotlinking (Sec-Fetch-Site), so the raw
      // api/file URL 403s in the browser. Route through the configured proxy —
      // same as audio playback (VITE_PIXELDRAIN_PROXY_URL).
      if (id) {
        return { type: 'pixeldrain', src: `${pixeldrainProxyBase()}/api/${id}` };
      }
    }
  }
  // Pillowcase last — only if no other embeddable source exists
  for (const link of links) {
    if (link.includes('pillows.su/f/')) {
      const id = extractPillowId(link);
      if (id) return { type: 'pillowcase', src: `https://api.pillows.su/api/get/${id}` };
    }
  }
  return null;
}

function getLinkLabel(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('drive.google.com')) return 'Drive';
  if (url.includes('pillows.su')) return 'Pillowcase';
  if (url.includes('archive.org')) return 'Archive.org';
  if (url.includes('pixeldrain.com')) return 'Pixeldrain';
  if (url.includes('vimeo.com')) return 'Vimeo';
  if (url.includes('streamable.com')) return 'Streamable';
  if (url.includes('mega.nz')) return 'MEGA';
  if (url.includes('sharemania.us')) return 'Sharemania';
  return 'Link';
}

function parseVideosData(rows: VideoRawEntry[], allEras: Era[]): VideoEraGroup[] {
  let currentSection: 'Unreleased' | 'Released' = 'Unreleased';
  const eraGroups: Record<string, { unreleased: VideoEntry[]; released: VideoEntry[] }> = {};
  const eraOrder: string[] = [];

  for (const row of rows) {
    const era = row.Era?.trim() || '';
    const name = row.Name?.trim() || '';

    if (!era) {
      if (name === 'Unreleased') currentSection = 'Unreleased';
      else if (name === 'Released') currentSection = 'Released';
      continue;
    }
    // Skip section-header rows where Era contains stats (e.g. "3 Released\n0 Unreleased\n...")
    if (era.includes('\n')) continue;
    if (!name) continue;

    if (!eraGroups[era]) {
      eraGroups[era] = { unreleased: [], released: [] };
      eraOrder.push(era);
    }

    const rawLinks = row['Link(s)'] || '';
    const links = rawLinks
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l && !l.toLowerCase().includes('link needed') && !l.toLowerCase().includes('source needed'));

    const entry: VideoEntry = {
      era,
      name,
      notes: row.Notes?.trim() || '',
      length: row.Length?.trim() || '',
      dateMade: row['Date Made']?.trim() || '',
      type: row.Type?.trim() || '',
      availableLength: row['Available Length']?.trim() || '',
      quality: row.Quality?.trim() || '',
      links,
      section: currentSection,
    };

    if (currentSection === 'Unreleased') {
      eraGroups[era].unreleased.push(entry);
    } else {
      eraGroups[era].released.push(entry);
    }
  }

  return eraOrder
    .map(name => {
      const group = eraGroups[name];
      const matchingEra = allEras.find(e => e.name === name);
      return {
        name,
        image: CUSTOM_IMAGES[name] || matchingEra?.image,
        unreleased: group.unreleased,
        released: group.released,
        total: group.unreleased.length + group.released.length,
      };
    })
    .filter(g => g.total > 0);
}

const AVAILABLE_LENGTH_COLORS: Record<string, string> = {
  'Full': 'text-green-400 border-green-500/20 bg-green-500/5',
  'OG File': 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
  'Snippet': 'text-blue-400 border-blue-500/20 bg-blue-500/5',
  'Partial': 'text-orange-400 border-orange-500/20 bg-orange-500/5',
  'Confirmed': 'text-white/40 border-white/10 bg-white/5',
  'Rumored': 'text-white/30 border-white/10 bg-white/5',
  'Never Recorded': 'text-red-400/50 border-red-500/10 bg-red-500/5',
};

// ─── Embed renderer (shared by inline and mini player) ─────────────────────

function EmbedPlayer({ embed, className = '' }: { embed: EmbedInfo; className?: string }) {
  if (!embed) return null;

  if (embed.type === 'youtube' || embed.type === 'drive') {
    return (
      <iframe
        src={embed.src}
        className={`w-full h-full ${className}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  if (embed.type === 'pillowcase' || embed.type === 'pixeldrain') {
    return (
      <video
        src={embed.src}
        controls
        className={`w-full h-full object-contain ${className}`}
        preload="metadata"
      />
    );
  }

  return null;
}

// ─── Mini / fullscreen player portal ───────────────────────────────────────

interface MiniPlayerProps {
  state: MiniPlayerState;
  onClose: () => void;
  onLinkChange: (i: number) => void;
}

function MiniPlayer({ state, onClose, onLinkChange }: MiniPlayerProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const activeLink = state.entry.links[state.linkIndex] ?? state.entry.links[0];
  const embed = activeLink ? getEmbedInfo([activeLink]) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) setIsFullScreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullScreen, onClose]);

  const linkTabs = state.entry.links.length > 1 ? (
    <div className="flex gap-1.5 flex-wrap px-3 pb-2">
      {state.entry.links.map((link, i) => (
        <button
          key={i}
          onClick={() => onLinkChange(i)}
          className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
            i === state.linkIndex
              ? 'border-[var(--theme-color)] text-[var(--theme-color)] bg-[var(--theme-color)]/10'
              : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
          }`}
        >
          {getLinkLabel(link)}
        </button>
      ))}
    </div>
  ) : null;

  return createPortal(
    <>
      {/* Fullscreen overlay */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            key="fs-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9100] bg-black flex flex-col"
          >
            {/* FS header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{state.entry.name}</p>
                <p className="text-xs text-white/40">{state.entry.era}</p>
              </div>
              <div className="flex items-center gap-2">
                {activeLink && (
                  <a
                    href={activeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open original link"
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setIsFullScreen(false)}
                  title="Exit fullscreen"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  title="Close"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FS link tabs */}
            {state.entry.links.length > 1 && (
              <div className="flex gap-1.5 flex-wrap px-4 pt-3 shrink-0">
                {state.entry.links.map((link, i) => (
                  <button
                    key={i}
                    onClick={() => onLinkChange(i)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                      i === state.linkIndex
                        ? 'border-[var(--theme-color)] text-[var(--theme-color)] bg-[var(--theme-color)]/10'
                        : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {getLinkLabel(link)}
                  </button>
                ))}
              </div>
            )}

            {/* FS video */}
            <div className="flex-1 min-h-0 p-4">
              {embed ? (
                <EmbedPlayer embed={embed} />
              ) : (
                <div className="flex items-center justify-center h-full text-white/30 text-sm">
                  No embeddable source available.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini player (always rendered while state is set, hidden during fullscreen) */}
      {!isFullScreen && (
        <motion.div
          key="mini-player"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-36 right-4 z-[9000] w-80 rounded-xl overflow-hidden bg-[#111] border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
        >
          {/* Mini header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">{state.entry.name}</p>
              <p className="text-[10px] text-white/40 truncate">{state.entry.era}</p>
            </div>
            {activeLink && (
              <a
                href={activeLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original link"
                className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => setIsFullScreen(true)}
              title="Fullscreen"
              className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mini video */}
          <div className="aspect-video w-full bg-black">
            {embed ? (
              <EmbedPlayer embed={embed} />
            ) : (
              <div className="flex items-center justify-center h-full text-white/30 text-xs">
                No embeddable source
              </div>
            )}
          </div>

          {/* Link tabs */}
          {linkTabs && <div className="pt-2">{linkTabs}</div>}
        </motion.div>
      )}
    </>,
    document.body
  );
}

// ─── Video row ──────────────────────────────────────────────────────────────

interface VideoRowProps {
  entry: VideoEntry;
  miniPlayerMode: boolean;
  activeMiniEntry: VideoEntry | null;
  onOpenMiniPlayer: (entry: VideoEntry) => void;
  onVideoPlay?: () => void;
}

function VideoRow({ entry, miniPlayerMode, activeMiniEntry, onOpenMiniPlayer, onVideoPlay }: VideoRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeLink, setActiveLink] = useState(0);

  const isUnavailable = !entry.links.length;
  const availColor = AVAILABLE_LENGTH_COLORS[entry.availableLength] || 'text-white/40 border-white/10 bg-white/5';
  const isStarred = entry.name.startsWith('⭐');
  const isInMiniPlayer = miniPlayerMode && activeMiniEntry === entry;

  const handleClick = () => {
    if (isUnavailable) return;
    if (miniPlayerMode) {
      onVideoPlay?.();
      onOpenMiniPlayer(entry);
    } else {
      if (!expanded) onVideoPlay?.();
      setExpanded(e => !e);
    }
  };

  const activeEmbedLink = entry.links[activeLink] ?? entry.links[0];
  const activeEmbed = activeEmbedLink ? getEmbedInfo([activeEmbedLink]) : null;

  return (
    <div className={`rounded-md overflow-hidden border transition-colors ${
      isInMiniPlayer
        ? 'border-[var(--theme-color)]/30 bg-[var(--theme-color)]/5'
        : expanded
        ? 'border-white/15 bg-white/[0.03]'
        : 'border-transparent hover:border-white/10 hover:bg-white/[0.02]'
    }`}>
      <div
        onClick={handleClick}
        className={`flex items-start gap-3 px-3 py-2.5 ${isUnavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="mt-0.5 shrink-0">
          {miniPlayerMode ? (
            <Film className={`w-4 h-4 ${isInMiniPlayer ? 'text-[var(--theme-color)]' : 'text-white/20'}`} />
          ) : expanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/20" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-sm font-medium truncate ${
              isInMiniPlayer ? 'text-[var(--theme-color)]' : isStarred ? 'text-yellow-300' : 'text-white'
            }`}>
              {entry.name}
            </span>
            {entry.length && (
              <span className="text-[10px] text-white/30 shrink-0">{entry.length}</span>
            )}
          </div>
          {entry.notes && (
            <div className="flex items-start gap-1 mt-0.5">
              <p className="min-w-0 flex-1 text-xs text-white/40 line-clamp-2">{entry.notes}</p>
              <NoteButton note={entry.notes} title={entry.name} className="-mt-0.5" />
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
          {entry.availableLength && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${availColor}`}>
              {entry.availableLength}
            </span>
          )}
          {entry.quality && (
            <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/50 bg-white/5">
              {entry.quality}
            </span>
          )}
          {entry.links.length > 0 && !expanded && !miniPlayerMode && (
            <ExternalLink className="w-3.5 h-3.5 text-white/30" />
          )}
          <CommentButton
            tracker={activeConfig.slug}
            entryKey={makeEntryKey('Videos', entry.era, entry.name)}
            entryLabel={entry.name}
            entryType="Videos"
          />
        </div>
      </div>

      {/* Inline expand (only in non-mini-player mode) */}
      <AnimatePresence>
        {!miniPlayerMode && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-4 space-y-3">
              {entry.links.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {entry.links.map((link, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveLink(i)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                        i === activeLink
                          ? 'border-[var(--theme-color)] text-[var(--theme-color)] bg-[var(--theme-color)]/10'
                          : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {getLinkLabel(link)}
                    </button>
                  ))}
                </div>
              )}

              {activeEmbed ? (
                <div className={`w-full rounded-md overflow-hidden bg-black ${
                  activeEmbed.type === 'pillowcase' ? '' : 'aspect-video'
                }`}>
                  <EmbedPlayer embed={activeEmbed} />
                </div>
              ) : (
                entry.links.length > 0 && (
                  <div className="text-xs text-white/40 italic">
                    No embeddable player available for this source.
                  </div>
                )
              )}

              {entry.links.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {entry.links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {getLinkLabel(link)}
                    </a>
                  ))}
                </div>
              )}

              {entry.dateMade && (
                <p className="text-[10px] text-white/30">Filmed: {entry.dateMade}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Era detail view ────────────────────────────────────────────────────────

interface EraDetailViewProps {
  eraGroup: VideoEraGroup;
  onBack: () => void;
  searchQuery: string;
  miniPlayerMode: boolean;
  activeMiniEntry: VideoEntry | null;
  onOpenMiniPlayer: (entry: VideoEntry) => void;
  onVideoPlay?: () => void;
}

function EraDetailView({ eraGroup, onBack, searchQuery, miniPlayerMode, activeMiniEntry, onOpenMiniPlayer, onVideoPlay }: EraDetailViewProps) {
  const filterEntries = (entries: VideoEntry[]) => {
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      e => e.name.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)
    );
  };

  const filteredUnreleased = filterEntries(eraGroup.unreleased);
  const filteredReleased = filterEntries(eraGroup.released);

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto custom-scrollbar pb-64"
    >
      <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
        <button
          onClick={onBack}
          className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl">
          {eraGroup.image ? (
            <Img w={400} eager
              src={eraGroup.image}
              alt={eraGroup.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-12 h-12 text-white/20" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end h-full py-2">
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              {eraGroup.name}
            </h1>
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              Music Videos
            </span>
            <CommentButton
              tracker={activeConfig.slug}
              entryKey={makeEraKey(eraGroup.name)}
              entryLabel={baseEraName(eraGroup.name)}
              entryType="Era"
              variant="pill"
            />
          </div>
          <p className="text-white/50 text-sm">
            {eraGroup.unreleased.length} unreleased · {eraGroup.released.length} released
          </p>
        </div>
      </div>

      <div className="px-4 md:px-8 mt-6 max-w-4xl mx-auto space-y-8">
        {filteredUnreleased.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400/70" />
              Unreleased
            </h2>
            <div className="space-y-1">
              {filteredUnreleased.map((entry, i) => (
                <VideoRow
                  key={i}
                  entry={entry}
                  miniPlayerMode={miniPlayerMode}
                  activeMiniEntry={activeMiniEntry}
                  onOpenMiniPlayer={onOpenMiniPlayer}
                  onVideoPlay={onVideoPlay}
                />
              ))}
            </div>
          </section>
        )}

        {filteredReleased.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400/70" />
              Released
            </h2>
            <div className="space-y-1">
              {filteredReleased.map((entry, i) => (
                <VideoRow
                  key={i}
                  entry={entry}
                  miniPlayerMode={miniPlayerMode}
                  activeMiniEntry={activeMiniEntry}
                  onOpenMiniPlayer={onOpenMiniPlayer}
                  onVideoPlay={onVideoPlay}
                />
              ))}
            </div>
          </section>
        )}

        {filteredUnreleased.length === 0 && filteredReleased.length === 0 && (
          <p className="text-white/40 text-sm text-center py-8">No results found.</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────

interface VideosViewProps {
  eras: Era[];
  videosData: VideoRawEntry[];
  searchQuery: string;
  onVideoPlay?: () => void;
}

export function VideosView({ eras, videosData, searchQuery, onVideoPlay }: VideosViewProps) {
  const { settings } = useSettings();
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [miniPlayer, setMiniPlayer] = useState<MiniPlayerState | null>(null);

  const eraGroups = useMemo(() => parseVideosData(videosData, eras), [videosData, eras]);

  const openMiniPlayer = useCallback((entry: VideoEntry) => {
    setMiniPlayer(prev =>
      prev?.entry === entry ? prev : { entry, linkIndex: 0 }
    );
  }, []);

  const closeMiniPlayer = useCallback(() => setMiniPlayer(null), []);

  const changeMiniLink = useCallback((i: number) => {
    setMiniPlayer(prev => prev ? { ...prev, linkIndex: i } : null);
  }, []);

  useEffect(() => {
    const path = relPath(window.location.pathname);
    if (path.startsWith('/videos/')) {
      const slug = path.split('/videos/')[1];
      if (slug) {
        const match = eraGroups.find(g => createSlug(g.name) === slug);
        if (match) setSelectedEra(match.name);
      }
    }
  }, [eraGroups]);

  useEffect(() => {
    const currentPath = relPath(window.location.pathname);
    if (selectedEra) {
      const newPath = `/videos/${createSlug(selectedEra)}`;
      if (currentPath !== newPath) {
        window.history.pushState({ videosEra: selectedEra }, '', absPath(newPath));
      }
    } else {
      if (currentPath.startsWith('/videos/')) {
        window.history.pushState({ videosEra: null }, '', absPath('/videos'));
      }
    }
  }, [selectedEra]);

  useEffect(() => {
    const handlePopState = () => {
      const path = relPath(window.location.pathname);
      if (path.startsWith('/videos/')) {
        const slug = path.split('/videos/')[1];
        const match = eraGroups.find(g => createSlug(g.name) === slug);
        setSelectedEra(match ? match.name : null);
      } else if (path === '/videos') {
        setSelectedEra(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [eraGroups]);

  // Close mini player when leaving videos tab (handled by parent unmounting)
  useEffect(() => () => setMiniPlayer(null), []);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return eraGroups;
    const q = searchQuery.toLowerCase();
    return eraGroups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      [...g.unreleased, ...g.released].some(
        e => e.name.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)
      )
    );
  }, [eraGroups, searchQuery]);

  const selectedGroup = useMemo(
    () => eraGroups.find(g => g.name === selectedEra) || null,
    [eraGroups, selectedEra]
  );

  const miniPlayerMode = settings.videosMiniPlayer;

  return (
    <>
      {selectedGroup ? (
        <EraDetailView
          eraGroup={selectedGroup}
          onBack={() => setSelectedEra(null)}
          searchQuery={searchQuery}
          miniPlayerMode={miniPlayerMode}
          activeMiniEntry={miniPlayer?.entry ?? null}
          onOpenMiniPlayer={openMiniPlayer}
          onVideoPlay={onVideoPlay}
        />
      ) : (
        <motion.div
          key="videos-grid"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
        >
          {filteredGroups.map((group, i) => (
            <motion.div
              key={group.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
              onClick={() => setSelectedEra(group.name)}
              className="group flex flex-col gap-3 cursor-pointer"
            >
              <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
                {group.image ? (
                  <Img w={300}
                    src={group.image}
                    alt={group.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Film className="w-10 h-10 text-white/20" />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex flex-col gap-1 items-end">
                  {group.unreleased.length > 0 && (
                    <span className="bg-black/70 backdrop-blur-sm text-orange-400 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      {group.unreleased.length} Unrel.
                    </span>
                  )}
                  {group.released.length > 0 && (
                    <span className="bg-black/70 backdrop-blur-sm text-green-400 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      {group.released.length} Rel.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white group-hover:underline truncate">
                  {group.name}
                </h3>
                <p className="text-xs text-white/40">{group.total} video{group.total !== 1 ? 's' : ''}</p>
              </div>
            </motion.div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="col-span-full text-center py-16 text-white/30 text-sm">
              No eras found.
            </div>
          )}
        </motion.div>
      )}

      {/* Mini player portal */}
      <AnimatePresence>
        {miniPlayerMode && miniPlayer && (
          <MiniPlayer
            key="mini-player"
            state={miniPlayer}
            onClose={closeMiniPlayer}
            onLinkChange={changeMiniLink}
          />
        )}
      </AnimatePresence>
    </>
  );
}
