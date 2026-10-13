import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, Play, Volume2, X, Star, Share2, Download } from 'lucide-react';
import { Era, Song, SearchFilters } from '../types';
import { useState, useMemo, useEffect } from 'react';
import { formatTextWithTags, getCleanSongNameWithTags, createSlug, isSongNotAvailable, looksLikeRealLink, matchesFilters, CUSTOM_IMAGES, parseNoteDescription , Img} from '../utils';
import { SongTitle } from './SongTitle';
import { FakesEntry } from '../App';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { CommentButton } from './CommentButton';
import { makeEntryKey, makeEraKey, baseEraName, stampSongComment } from '../comments';
import { activeConfig } from '../artists/activeConfig';

interface FakesViewProps {
  eras: Era[];
  fakesData: FakesEntry[];
  searchQuery: string;
  filters: SearchFilters;
  onPlaySong: (song: Song, era: Era, contextTracks: Song[]) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  toggleFavorite?: (song: Song, eraName: string) => void;
  favoriteKeys?: { songName: string; eraName: string; url: string }[];
}

const ERA_MAPPINGS: Record<string, string> = {
  "Donda [V1]": "DONDA [V1]",
  "Bully": "BULLY [V1]",
  "BULLY": "BULLY [V1]"
};

function parseFakesToEras(fakesData: FakesEntry[], allEras: Era[]) {
  const eraOrder: string[] = [];
  const eraImages: Record<string, string | undefined> = {};
  const fakesByEra: Record<string, FakesEntry[]> = {};
  const mappingBack: Record<string, string> = {};

  for (const item of fakesData) {
    if (!item.Era || !item.Name) continue;
    
    const standardEraName = ERA_MAPPINGS[item.Era] || item.Era;
    
    if (!fakesByEra[standardEraName]) {
       fakesByEra[standardEraName] = [];
       mappingBack[standardEraName] = item.Era;
    }
    fakesByEra[standardEraName].push(item);
    
    if (!eraOrder.includes(standardEraName)) {
      eraOrder.push(standardEraName);
      const matchingEra = allEras.find(e => e.name === standardEraName);
      eraImages[standardEraName] = CUSTOM_IMAGES[standardEraName] || CUSTOM_IMAGES[item.Era] || matchingEra?.image;
    }
  }

  return eraOrder
    .filter(name => fakesByEra[name] && fakesByEra[name].length > 0)
    .map(name => ({
      eraName: `${name} [Fake Leaks]`,
      originalFakesEraName: mappingBack[name] || name,
      image: eraImages[name],
      fakes: fakesByEra[name]
    }));
}

export function FakesView({ eras, fakesData, searchQuery, filters, onPlaySong, currentSong, isPlaying, toggleFavorite, favoriteKeys = [] }: FakesViewProps) {
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const parsedEras = useMemo(() => {
    try {
      return parseFakesToEras(fakesData, eras).filter(era =>
        era.eraName !== 'NASIR [Fake]' &&
        era.eraName !== 'K.T.S.E. [Fake]' &&
        era.eraName !== 'NEVER STOP [Fake]' &&
        era.eraName !== 'DAYTONA [Fake]' &&
        era.eraName !== 'NASIR [Fake Leaks]' &&
        era.eraName !== 'Man Across The Sea [Fake Leaks]'
      );
    } catch (err) {
      console.error('Error parsing fakes data:', err);
      return [];
    }
  }, [fakesData, eras]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/fakes/')) {
      const slug = path.split('/fakes/')[1];
      if (slug) {
        if (slug === createSlug('NASIR [Fake Leaks]') || slug === 'man-across-the-sea-fake-leaks') {
           window.history.pushState(null, '', '/fakes');
           window.dispatchEvent(new Event('popstate'));
           return;
        }
        const match = parsedEras.find(e => createSlug(e.eraName) === slug);
        if (match) setSelectedEra(match.eraName);
      }
    }
  }, [parsedEras]);

  useEffect(() => {
    if (selectedEra) {
      const newPath = `/fakes/${createSlug(selectedEra)}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({ fakesEra: selectedEra }, '', newPath);
      }
    } else {
      if (window.location.pathname.startsWith('/fakes/')) {
        window.history.pushState({ fakesEra: null }, '', '/fakes');
      }
    }
  }, [selectedEra]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/fakes/')) {
        const slug = path.split('/fakes/')[1];
        const match = parsedEras.find(e => createSlug(e.eraName) === slug);
        setSelectedEra(match ? match.eraName : null);
      } else if (path === '/fakes') {
        setSelectedEra(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parsedEras]);

  const filteredEras = useMemo(() => {
    const hasActiveFilters = searchQuery || filters.tags.length > 0 || filters.qualities.length > 0 || filters.playableOnly || filters.excludedTags?.length > 0 || filters.excludedQualities?.length > 0;
    if (!hasActiveFilters) return parsedEras;

    return parsedEras.map(era => {
      if (searchQuery && era.eraName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return era;
      }
      const matchingFakes = era.fakes.filter(f => {
        const rawUrl = f["Link(s)"]?.trim() || "";
        const pseudoSong: Song = {
          name: `${f.Name} [Fake Leak]`,
          extra: f.Era,
          url: rawUrl,
          quality: f.Type,
          available_length: f["Available Length"] === 'Not Available' ? '' : f["Available Length"],
          description: (f.Notes || '') + (f["Made By"] ? ` Made By: ${f["Made By"]}` : ''),
          fakesType: f.Type,
          fakesLength: f["Available Length"] === 'Not Available' ? '' : f["Available Length"],
        };

        if (filters.playableOnly) {
           const isPlayable = rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/');
           if (!isPlayable || isSongNotAvailable(pseudoSong, rawUrl)) return false;
        }

        return matchesFilters(pseudoSong, searchQuery, filters);
      });
      return { ...era, fakes: matchingFakes };
    }).filter(era => era.fakes.length > 0);
  }, [parsedEras, searchQuery, filters]);

  const selectedEraData = useMemo(() => {
    if (!selectedEra) return null;
    return parsedEras.find(e => e.eraName === selectedEra) || null;
  }, [selectedEra, parsedEras]);

  const filteredFakes = useMemo(() => {
    if (!selectedEraData) return [];
    
    return selectedEraData.fakes.filter(f => {
      const rawUrl = f["Link(s)"]?.trim() || "";
      const pseudoSong: Song = {
        name: `${f.Name} [Fake Leak]`,
        extra: f.FeatureExtra,
        extra2: f.Era,
        url: rawUrl,
        quality: f.Type,
        available_length: f["Available Length"] === 'Not Available' ? '' : f["Available Length"],
        description: (f.Notes || '') + (f["Made By"] ? ` Made By: ${f["Made By"]}` : ''),
        fakesType: f.Type,
        fakesLength: f["Available Length"] === 'Not Available' ? '' : f["Available Length"],
      };

      if (filters.playableOnly) {
         const isPlayable = rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/');
         if (!isPlayable || isSongNotAvailable(pseudoSong, rawUrl)) return false;
      }
      
      return matchesFilters(pseudoSong, searchQuery, filters);
    });
  }, [selectedEraData, searchQuery, filters]);

  const fakesAsSongs: Song[] = useMemo(() => {
     return filteredFakes.map(f => {
       const rawUrl = f["Link(s)"]?.trim() || "";
       let desc = "";
       if (f["Made By"]) desc += `Made By: ${f["Made By"]}\n`;
       if (f.Notes) desc += f.Notes;

       const song: Song = {
         name: `${f.Name} [Fake Leak]`,
         extra: f.FeatureExtra,
         extra2: f.Era,
         url: rawUrl,
         quality: f.Type,
         available_length: f["Available Length"] === 'Not Available' ? '' : f["Available Length"],
         description: desc.trim() || undefined,
         track_length: undefined,
         fakesType: f.Type,
         fakesLength: f["Available Length"] === 'Not Available' ? '' : f["Available Length"],
       };
       return stampSongComment(song, { tracker: activeConfig.slug, type: 'Fakes', era: selectedEraData?.eraName || '' });
     });
  }, [filteredFakes, selectedEraData]);

  const allPlayableFakes = useMemo(() => {
    return fakesAsSongs.filter(s => {
      const isNotAvailable = isSongNotAvailable(s, s.url || '');
      return s.url && (s.url.includes('pillows.su/f/') || s.url.includes('imgur.gg/f/') || s.url.includes('i.imgur.com') || s.url.includes('krakenfiles.com/view/') || s.url.includes('pixeldrain.com/u/')) && !isNotAvailable;
    });
  }, [fakesAsSongs]);

  const dummyEra: Era = useMemo(() => {
    return {
      name: selectedEraData?.eraName || 'Fakes',
      image: selectedEraData?.image,
      data: { "Fakes": fakesAsSongs }
    };
  }, [selectedEraData, fakesAsSongs]);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  const handleShareEra = () => {
    if (!selectedEraData) return;
    const shareUrl = `${window.location.origin}/fakes/${createSlug(selectedEraData.eraName)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      triggerToast('Link copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      triggerToast('Failed to copy link');
    });
  };

  const handleShareSong = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedEraData) return;
    const shareUrl = `${window.location.origin}/fakes/${createSlug(selectedEraData.eraName)}?song=${createSlug(song.name)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      triggerToast('Song link copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      triggerToast('Failed to copy link');
    });
  };

  if (selectedEraData) {
    return (
      <>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {zoomedImage && selectedEraData.image && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoomedImage(false)}
                className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
              >
                <Img w={1200} eager src={selectedEraData.image} alt={selectedEraData.eraName} className="max-w-full max-h-full object-contain shadow-2xl rounded-md" />
              </motion.div>
            )}
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[10100] px-6 py-3 bg-white text-black font-bold rounded-full shadow-[0_8px_30px_rgb(255,255,255,0.2)] flex items-center gap-2 text-[15px] tracking-wide"
              >
                {toastMessage}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto custom-scrollbar pb-64"
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
            <button onClick={() => setSelectedEra(null)} className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div
              className={`w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl ${selectedEraData.image ? 'cursor-pointer' : ''}`}
              onClick={() => { if (selectedEraData.image) setZoomedImage(true); }}
              title={selectedEraData.image ? "Click to zoom" : undefined}
            >
              {selectedEraData.image ? (
                <Img w={400} src={selectedEraData.image} alt={selectedEraData.eraName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">{selectedEraData.eraName}</div>
              )}
            </div>

            <div className="flex flex-col justify-end h-full py-2">
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight flex items-center gap-4 flex-wrap">
                  <div className="truncate">{formatTextWithTags(selectedEraData.eraName)}</div>
                </h1>
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Fakes
                </span>
              </div>
              <p className="text-white/50 text-sm mb-4">Rumors, Fake Leaks, Edits, and Compilations</p>

              <div className="flex items-center gap-2 mt-auto">
                <CommentButton
                  tracker={activeConfig.slug}
                  entryKey={makeEraKey(selectedEraData.eraName)}
                  entryLabel={baseEraName(selectedEraData.eraName)}
                  entryType="Era"
                  variant="pill"
                />
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 mt-8 max-w-6xl mx-auto">
            <div className="mb-10">
              <div className="flex flex-col">
                <div className="flex items-center px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 mb-2 hidden sm:flex">
                  <div className="w-8">#</div>
                  <div className="flex-1">Title</div>
                  <div className="w-40">Type / Length</div>
                  <div className="w-16"></div>
                </div>

                {fakesAsSongs.map((song, i) => {
                  const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                  const isNotAvailable = isSongNotAvailable(song, rawUrl);
                  const lowerUrl = (rawUrl || '').toLowerCase();
                  const isTrulyEmptyLink = !rawUrl || lowerUrl === 'n/a' || lowerUrl.includes('link needed') || lowerUrl.includes('source needed') || !looksLikeRealLink(rawUrl);
                  const isPlayable = rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/');
                  const isEmpty = isTrulyEmptyLink || isNotAvailable || lowerUrl.includes('n/a');
                  const isCurrentlyPlaying = (currentSong?.url && song.url && currentSong.url === song.url);
                  const isStarred = favoriteKeys.some(k => k.songName === song.name && k.url === rawUrl);

                  return (
                     <div
                        key={i}
                        onClick={() => !isEmpty && onPlaySong(song, dummyEra, allPlayableFakes)}
                        className={`group flex items-center px-4 py-2.5 rounded-md transition-colors ${isEmpty ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'} ${isCurrentlyPlaying ? 'bg-white/5' : ''}`}
                     >
                        <div className={`w-8 text-sm font-mono flex items-center ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white/40 group-hover:text-white'}`}>
                           <span className="group-hover:hidden">
                              {isCurrentlyPlaying ? <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} /> : (i + 1)}
                           </span>
                           {isEmpty ? (
                              <X className="w-4 h-4 hidden group-hover:block text-white/40" />
                           ) : isPlayable ? (
                              <Play className="w-4 h-4 hidden group-hover:block" />
                           ) : (
                              <ExternalLink className="w-4 h-4 hidden group-hover:block" />
                           )}
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                           <div className={`flex items-baseline gap-2 truncate font-medium ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                              <SongTitle name={song.name} />
                           </div>
                           {song.description && (() => {
                              const { note, ogFilename } = parseNoteDescription(song.description);
                              const display = note ? note.replace(/\n/g, '  •  ') : ogFilename ? `OG: ${ogFilename}` : null;
                              return display ? (
                                <div className={`flex items-center gap-2 text-xs line-clamp-1 mt-0.5 ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/40' : 'text-white/40'}`}>
                                  {formatTextWithTags(display)}
                                </div>
                              ) : null;
                           })()}
                        </div>

                        <div className="w-40 shrink-0 hidden sm:flex items-center gap-1.5 flex-wrap">
                           {song.quality && (
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/80 bg-[var(--theme-color)]/5' : 'border-white/10 text-white/60 bg-white/5'}`}>
                                 {song.quality}
                              </span>
                           )}
                           {song.available_length && (
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/80 bg-[var(--theme-color)]/5' : 'border-white/10 text-white/60 bg-white/5'}`}>
                                 {song.available_length}
                              </span>
                           )}
                        </div>

                        <div className="w-16 shrink-0 hidden sm:flex items-center justify-end gap-2">
                          {isPlayable && (
                            <AddToPlaylistButton
                              song={song}
                              eraName={song.extra || 'Fakes'}
                              url={rawUrl}
                              isCurrentlyPlaying={!!isCurrentlyPlaying}
                            />
                          )}
                          <CommentButton
                            tracker={activeConfig.slug}
                            entryKey={makeEntryKey('Fakes', selectedEraData?.eraName || '', song.name)}
                            entryLabel={song.name}
                            entryType="Fakes"
                            isCurrentlyPlaying={!!isCurrentlyPlaying}
                          />
                        </div>
                     </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      key="fakes-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
    >
      {filteredEras.map((era, i) => (
        <motion.div
          key={era.eraName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
          onClick={() => setSelectedEra(era.eraName)}
          className="group flex flex-col gap-3 cursor-pointer"
        >
          <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
            {era.image ? (
              <Img w={300} src={era.image} alt={era.eraName} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-2xl text-center p-4">
                {era.eraName}
              </div>
            )}
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
              {era.fakes.length} Fakes
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white group-hover:underline truncate flex items-center gap-2">
              <div className="truncate">{formatTextWithTags(era.eraName)}</div>
            </h3>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
