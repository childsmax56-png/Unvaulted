import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronDown, ChevronRight, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Era, Song } from '../types';
import { parseContributors, formatTextWithTags, isSongNotAvailable, CUSTOM_IMAGES , Img} from '../utils';
import { activeConfig } from '../artists/activeConfig';

interface ContributorSong {
  song: Song;
  era: Era;
}

interface ContributorViewProps {
  contributorName: string;
  eras: Era[];
  onBack: () => void;
  onPlaySong: (song: Song, era: Era, contextTracks?: Song[]) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

function songsForContributor(name: string, eras: Era[]): ContributorSong[] {
  const lower = name.toLowerCase();
  const results: ContributorSong[] = [];

  for (const era of eras) {
    for (const songs of Object.values(era.data || {})) {
      for (const song of songs as Song[]) {
        // Contributors live in song.extra (second+ lines of the CSV name cell)
        const contributors = parseContributors(song.extra || '');
        const isContributor = contributors.some(c => c.toLowerCase() === lower);

        // Also check if name is the primary artist in "Name - Title" format
        const dashIdx = song.name.indexOf(' - ');
        const primaryArtist = dashIdx !== -1 ? song.name.slice(0, dashIdx).toLowerCase() : null;
        const isPrimary = primaryArtist === lower || (primaryArtist != null && primaryArtist.includes(lower));

        const mainArtist = activeConfig.getArtistName(undefined).toLowerCase();
        if (isContributor || (isPrimary && lower !== mainArtist)) {
          results.push({ song, era });
        }
      }
    }
  }

  return results;
}

// Chip-style multi-select filter component
function FilterChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-white/40 shrink-0 w-20">{label}</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors cursor-pointer ${
            selected.has(opt)
              ? 'bg-[var(--theme-color)]/20 border-[var(--theme-color)]/60 text-[var(--theme-color)]'
              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function ContributorView({ contributorName, eras, onBack, onPlaySong, currentSong, isPlaying }: ContributorViewProps) {
  const allMatches = useMemo(() => songsForContributor(contributorName, eras), [contributorName, eras]);

  // --- Collect distinct filter values from results ---
  const allEraNames = useMemo(() => [...new Set(allMatches.map(m => m.era.name))], [allMatches]);
  const allAvailabilities = useMemo(() => {
    const s = new Set<string>();
    allMatches.forEach(({ song }) => { if (song.available_length) s.add(song.available_length); });
    return [...s].sort();
  }, [allMatches]);
  const allQualities = useMemo(() => {
    const s = new Set<string>();
    allMatches.forEach(({ song }) => { if (song.quality) s.add(song.quality); });
    return [...s].sort();
  }, [allMatches]);

  // --- Filter state ---
  const [eraFilter, setEraFilter] = useState<Set<string>>(new Set());
  const [availFilter, setAvailFilter] = useState<Set<string>>(new Set());
  const [qualFilter, setQualFilter] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedEras, setCollapsedEras] = useState<Set<string>>(new Set());

  const toggleFilter = (set: Set<string>, setter: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const clearAllFilters = () => {
    setEraFilter(new Set());
    setAvailFilter(new Set());
    setQualFilter(new Set());
  };

  const hasActiveFilters = eraFilter.size > 0 || availFilter.size > 0 || qualFilter.size > 0;

  // --- Apply filters ---
  const filtered = useMemo(() => {
    return allMatches.filter(({ song, era }) => {
      if (eraFilter.size > 0 && !eraFilter.has(era.name)) return false;
      if (availFilter.size > 0 && !availFilter.has(song.available_length || '')) return false;
      if (qualFilter.size > 0 && !qualFilter.has(song.quality || '')) return false;
      return true;
    });
  }, [allMatches, eraFilter, availFilter, qualFilter]);

  // --- Group by era ---
  const byEra = useMemo(() => {
    const map = new Map<string, ContributorSong[]>();
    for (const item of filtered) {
      const key = item.era.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  const allPlayable = useMemo(
    () => filtered.map(m => m.song).filter(s => {
      const url = s.url || (s.urls?.[0] ?? '');
      return url && !isSongNotAvailable(s, url) && (url.includes('pillows.su/f/') || url.includes('imgur.gg/f/') || url.includes('i.imgur.com') || url.includes('krakenfiles.com/view/') || url.includes('pixeldrain.com/u/'));
    }),
    [filtered]
  );

  const toggleEraCollapse = (eraName: string) => {
    setCollapsedEras(prev => {
      const next = new Set(prev);
      if (next.has(eraName)) next.delete(eraName); else next.add(eraName);
      return next;
    });
  };

  const collapseAll = () => setCollapsedEras(new Set(byEra.map(([name]) => name)));
  const expandAll = () => setCollapsedEras(new Set());

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="absolute inset-0 z-10 bg-[#0a0a0a] overflow-y-auto pb-64"
    >
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-white/5 flex items-start gap-4">
        <button
          onClick={onBack}
          className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{contributorName}</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {filtered.length !== allMatches.length
              ? `${filtered.length} of ${allMatches.length} song${allMatches.length !== 1 ? 's' : ''}`
              : `${allMatches.length} song${allMatches.length !== 1 ? 's' : ''}`} on this tracker
            {' · '}
            <Link to={`/producers/${encodeURIComponent(contributorName)}`} className="inline-flex items-center gap-1 text-[var(--theme-color)] hover:underline">
              Credits across all trackers <ExternalLink className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 md:px-8 py-3 border-b border-white/5 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
              showFilters || hasActiveFilters
                ? 'border-[var(--theme-color)]/50 text-[var(--theme-color)] bg-[var(--theme-color)]/10'
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
            }`}
          >
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="bg-[var(--theme-color)] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {eraFilter.size + availFilter.size + qualFilter.size}
              </span>
            )}
          </button>

          {byEra.length > 1 && (
            <>
              <button
                onClick={collapseAll}
                className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              >
                Collapse all
              </button>
              <button
                onClick={expandAll}
                className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              >
                Expand all
              </button>
            </>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer ml-auto"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-2.5"
            >
              <FilterChips
                label="Era"
                options={allEraNames}
                selected={eraFilter}
                onToggle={v => toggleFilter(eraFilter, setEraFilter, v)}
              />
              <FilterChips
                label="Available"
                options={allAvailabilities}
                selected={availFilter}
                onToggle={v => toggleFilter(availFilter, setAvailFilter, v)}
              />
              <FilterChips
                label="Quality"
                options={allQualities}
                selected={qualFilter}
                onToggle={v => toggleFilter(qualFilter, setQualFilter, v)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Song list */}
      {filtered.length === 0 ? (
        <div className="p-8 text-white/30 text-sm">
          {hasActiveFilters ? 'No songs match the current filters.' : 'No songs found for this contributor.'}
        </div>
      ) : (
        <div className="p-4 md:p-6 space-y-4">
          {byEra.map(([eraName, items]) => {
            const era = items[0].era;
            const coverImage = CUSTOM_IMAGES[eraName] || era.image;
            const isCollapsed = collapsedEras.has(eraName);

            return (
              <div key={eraName} className="border border-white/5 rounded-xl overflow-hidden">
                {/* Era header — clickable to collapse */}
                <button
                  onClick={() => toggleEraCollapse(eraName)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                >
                  {coverImage && (
                    <Img w={100}
                      src={coverImage}
                      alt={eraName}
                      className="w-9 h-9 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-white/80 text-sm font-semibold truncate block">{eraName}</span>
                    <span className="text-white/30 text-[11px]">{items.length} song{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                  }
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-white/[0.04]">
                        {items.map(({ song }, idx) => {
                          const rawUrl = song.url || (song.urls?.[0] ?? '');
                          const isNotAvailable = isSongNotAvailable(song, rawUrl);
                          const isPlayable = !!rawUrl && !isNotAvailable && (
                            rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/')
                          );
                          const isCurrentlyPlaying =
                            currentSong?.name === song.name && currentSong?.description === song.description;

                          return (
                            <div
                              key={idx}
                              onClick={() => isPlayable && onPlaySong(song, era, allPlayable)}
                              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                                isPlayable ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-50'
                              } ${isCurrentlyPlaying ? 'bg-white/5' : ''}`}
                            >
                              <span className={`text-xs font-mono w-5 shrink-0 text-center ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white/25'}`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                                  {formatTextWithTags(song.name)}
                                </div>
                                {song.extra && (
                                  <div className={`text-xs truncate mt-0.5 ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/50' : 'text-white/35'}`}>
                                    {formatTextWithTags(song.extra)}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {song.available_length && (
                                  <span className="text-[10px] text-white/25 hidden sm:block">{song.available_length}</span>
                                )}
                                {song.quality && (
                                  <span className="text-[10px] text-white/25 hidden sm:block">{song.quality}</span>
                                )}
                                {song.track_length && (
                                  <span className="text-[10px] text-white/30 font-mono">{song.track_length}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
