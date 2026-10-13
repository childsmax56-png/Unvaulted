import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, Maximize2, MoreHorizontal, Download, X, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Star, Mic2, ListMusic, Square, ExternalLink, Share2, Plus, Check } from 'lucide-react';
import { parseArtistFromSong } from '../lastfm';
import { Song, Era } from '../types';
import { useState, useRef, useEffect } from 'react';
import { formatTextWithTags, CUSTOM_IMAGES, ALBUM_RELEASE_DATES, buildArtistTag, buildTitleTag, buildDownloadName, handleDownloadFile, ERA_THEMES , Img, looksLikeRealLink} from '../utils';
import { handleShareSilent } from './EraDetail';
import { LyricsModal } from './LyricsModal';
import { useSettings } from '../SettingsContext';
import { usePlaylists } from '../PlaylistContext';
import { activeConfig } from '../artists/activeConfig';
import { eraArtwork } from '../eraArtwork';
import { CommentsModal } from './CommentsModal';
import { MessageCircle } from 'lucide-react';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerBar({
  currentSong, isPlaying, togglePlay, onFullScreen, onClose, era, currentTime = 0, duration = 0, onSeek, volume = 1, onVolumeChange,
  onNext, onPrev, isShuffle, toggleShuffle, loopMode, toggleLoop, isFavorite, toggleFavorite, onShowQueue, showQueue, setShowQueue, allowDownload = true, allowFullScreen = true, artworkOverride, artistOverride
}: {
  currentSong: Song | null, isPlaying: boolean, togglePlay: () => void, onFullScreen: () => void, onClose: () => void, era: Era | null, currentTime?: number, duration?: number, onSeek?: (time: number) => void, volume?: number, onVolumeChange?: (vol: number) => void,
  onNext?: () => void, onPrev?: () => void, isShuffle?: boolean, toggleShuffle?: () => void, loopMode?: number, toggleLoop?: () => void,
  isFavorite?: boolean, toggleFavorite?: () => void, onShowQueue?: () => void,
  showQueue?: boolean,
  setShowQueue?: (v: boolean) => void,
  allowDownload?: boolean,
  allowFullScreen?: boolean,
  // Artwork/artist resolved under the song's own artist config. When set, they
  // win over config-derived lookups so a persisted song keeps its correct cover
  // and artist even while viewing a different artist's tracker.
  artworkOverride?: string,
  artistOverride?: string
}) {
  const { settings } = useSettings();
  const { playlists, addToPlaylist, createPlaylist } = usePlaylists();
  const [showMenu, setShowMenu] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playlistMenuRef = useRef<HTMLDivElement>(null);
  const newPlaylistInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleToggleLyrics = () => {
      const isLyricsDisabled = currentSong?.name.includes('???') || currentSong?.name.toLowerCase().includes('remix') || currentSong?.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');
      if (!isLyricsDisabled) {
        setShowLyrics(prev => !prev);
      }
    };

    window.addEventListener('toggle-lyrics', handleToggleLyrics);
    return () => window.removeEventListener('toggle-lyrics', handleToggleLyrics);
  }, [currentSong, era]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  useEffect(() => {
    const handleClickOutsidePlaylistMenu = (event: MouseEvent) => {
      if (playlistMenuRef.current && !playlistMenuRef.current.contains(event.target as Node)) {
        setShowPlaylistMenu(false);
        setCreatingPlaylist(false);
        setNewPlaylistName('');
      }
    };

    if (showPlaylistMenu) {
      document.addEventListener('mousedown', handleClickOutsidePlaylistMenu);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsidePlaylistMenu);
    };
  }, [showPlaylistMenu]);

  useEffect(() => {
    if (creatingPlaylist && newPlaylistInputRef.current) newPlaylistInputRef.current.focus();
  }, [creatingPlaylist]);

  useEffect(() => {
    const handleMouseUp = () => setIsDraggingVolume(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingVolume && volumeRef.current && onVolumeChange) {
        const rect = volumeRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onVolumeChange(percent);
      }
    };

    if (isDraggingVolume) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVolume, onVolumeChange]);

  useEffect(() => {
    const handleMouseUp = () => setIsDraggingProgress(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress && progressRef.current && onSeek && duration) {
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(percent * duration);
      }
    };

    if (isDraggingProgress) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProgress, onSeek, duration]);

  useEffect(() => {
    if (currentSong || era) {
      const isLyricsDisabled = currentSong?.name.includes('???') || currentSong?.name.toLowerCase().includes('remix') || currentSong?.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');
      if (isLyricsDisabled && showLyrics) {
        setShowLyrics(false);
      }
    }
  }, [currentSong, era, showLyrics]);

  if (!currentSong) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !duration || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onVolumeChange || !volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onVolumeChange(percent);
  };

  const handleVolumeWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!onVolumeChange) return;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    onVolumeChange(Math.max(0, Math.min(1, volume + delta)));
  };

  const artistName = artistOverride || parseArtistFromSong(currentSong.name, currentSong.extra, (currentSong as any).realEra?.name || era?.name);
  const titleDisplay = currentSong.name.includes(' - ') ? currentSong.name.substring(currentSong.name.indexOf(' - ') + 3) : currentSong.name;

  const rawUrl = currentSong.url || (currentSong.urls && currentSong.urls.length > 0 ? currentSong.urls[0] : '');
  const downloadUrl = rawUrl.includes('pillows.su/f/')
    ? `https://api.pillows.su/api/download/${rawUrl.split('/f/')[1]}`
    : rawUrl;

  const playlistEraName = (currentSong as any).realEra?.name || era?.name || '';

  const buildPlaylistEntry = () => {
    const cleanSong = { ...currentSong };
    delete (cleanSong as any).realEra;
    return {
      songName: currentSong.name,
      eraName: playlistEraName,
      url: rawUrl,
      song: cleanSong,
      tracker: activeConfig.slug,
      image: eraArtwork(activeConfig.slug, playlistEraName) || currentSong.image || activeConfig.logoUrl,
      artist: activeConfig.getArtistName(playlistEraName),
    };
  };

  const handleAddToPlaylist = (playlistId: string) => {
    addToPlaylist(playlistId, buildPlaylistEntry());
    setShowPlaylistMenu(false);
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const id = createPlaylist(newPlaylistName.trim());
    addToPlaylist(id, buildPlaylistEntry());
    setNewPlaylistName('');
    setCreatingPlaylist(false);
    setShowPlaylistMenu(false);
  };

  const handleShare = () => {
    if (!era) return;
    let linkToCopy: string;
    if (settings.shareLinkType === 'pillowcase' && rawUrl && rawUrl.includes('pillows.su/f/')) {
      linkToCopy = rawUrl;
    } else {
      linkToCopy = handleShareSilent(currentSong, era);
    }
    navigator.clipboard.writeText(linkToCopy);
    setShareToast('Link copied!');
    setTimeout(() => setShareToast(null), 2500);
    setShowMenu(false);
  };

  return (
    <>
      <motion.div
        initial={{ y: 100, opacity: 0, filter: 'blur(10px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        exit={{ y: 100, opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed bottom-0 left-0 right-0 py-3 pb-safe md:py-0 md:h-24 bg-black/70 md:bg-black/60 backdrop-blur-3xl md:backdrop-blur-2xl border-t border-white/10 z-50 grid grid-cols-[1fr_auto] md:flex items-center px-4 md:px-6 gap-y-4 gap-x-0 md:gap-0 rounded-t-3xl md:rounded-none"
        style={!settings.disableEraThemes && ERA_THEMES[era?.name ?? '']?.miniPlayer ? {
          backgroundImage: `url(${ERA_THEMES[era!.name].miniPlayer})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        <div className="flex items-center gap-4 min-w-0 md:flex-1 col-start-1 col-end-2 row-start-1 pr-4 md:pr-0">
          {settings.showMiniPlayerArt && (() => {
            const actualEraName = (currentSong as any).realEra?.name || era?.name || '';
            const imgUrl = artworkOverride || currentSong.image || CUSTOM_IMAGES[actualEraName] || (currentSong as any).realEra?.image || era?.image;
            return (
              <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-white/10 relative group shadow-lg">
                {imgUrl && <Img w={200} eager src={imgUrl} alt="Cover" className={`w-full h-full object-cover ${allowFullScreen ? 'cursor-pointer' : ''}`} onClick={allowFullScreen ? onFullScreen : undefined} />}
                {toggleFavorite && 
               currentSong.name !== "Alright but the beat is Father Stretch My Hands Pt. 1" && 
               !currentSong.name.endsWith('[Fake Leak]') && 
               !(era?.name || '').includes('Fake') && 
               !currentSong.name.endsWith('[Stems]') && 
               !(era?.name || '').includes('Stems') && 
               !currentSong.name.endsWith('[Misc]') && 
               !(era?.name || '').includes('Misc') && (
                <div 
                   className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                   onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
                >
                  <Star className={`w-6 h-6 ${isFavorite ? 'fill-[var(--theme-color)] text-[var(--theme-color)]' : 'text-white'}`} />
                </div>
               )}
              </div>
            );
          })()}
          <div className={`min-w-0${!settings.disableEraThemes && ERA_THEMES[era?.name ?? '']?.miniPlayer ? ' drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : ''}`}>
            <div className="text-white font-bold break-words whitespace-normal leading-tight text-sm md:text-base pr-2">{formatTextWithTags(titleDisplay)}</div>
            <div className="text-white/50 text-xs truncate mt-0.5">{artistName} • {formatTextWithTags(currentSong.extra || (currentSong as any).realEra?.name || era?.name)}</div>
          </div>
        </div>

        <div className={`flex flex-col items-center justify-center col-span-2 row-start-2 md:col-auto md:row-auto md:flex-[2] w-full px-1 md:px-4${!settings.disableEraThemes && ERA_THEMES[era?.name ?? '']?.miniPlayer ? ' drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : ''}`}>
          <div className="flex items-center justify-between md:justify-center w-full md:w-auto gap-4 md:gap-6 mb-3 md:mb-2 px-2 md:px-0">
            <button onClick={toggleShuffle} className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${isShuffle ? 'text-white' : 'text-white/40 hover:text-white/80'}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shrink-0 shadow-lg cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            <button onClick={onNext} className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button onClick={toggleLoop} className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${loopMode !== 0 ? 'text-white' : 'text-white/40 hover:text-white/80'}`}>
              {loopMode === 1 ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>
          <div className="w-full flex items-center gap-3 px-2 md:px-0 text-[10px] md:text-[10px] font-mono text-white/50">
            <span className="w-8 md:w-8 text-right">{formatTime(currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative group"
              onMouseDown={(e) => {
                setIsDraggingProgress(true);
                handleSeek(e);
              }}
            >
              <div
                className="absolute top-0 left-0 h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-8 md:w-8">{duration ? formatTime(duration) : (currentSong.track_length || '0:00')}</span>
          </div>
        </div>

        <div className={`flex items-center justify-end gap-3 md:gap-6 col-start-2 col-end-3 row-start-1 md:flex-1 relative md:static${!settings.disableEraThemes && ERA_THEMES[era?.name ?? '']?.miniPlayer ? ' drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : ''}`}>
          <button 
            onClick={() => {
              if (showLyrics) setShowLyrics(false);
              if (setShowQueue) setShowQueue(!showQueue);
              else onShowQueue?.();
            }}
            className={`hidden md:flex items-center justify-center transition-colors cursor-pointer ${showQueue ? 'text-[var(--theme-color)]' : 'text-white/40 hover:text-white'}`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          {(() => {
            const isLyricsDisabled = currentSong.name.includes('???') || currentSong.name.toLowerCase().includes('remix') || currentSong.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');
            const tooltipText = currentSong.name.includes('???') ? "Song has no name" : isLyricsDisabled ? "Lyrics unavailable for remixes" : "Lyrics";
            
            return (
              <button 
                onClick={() => {
                  if (!isLyricsDisabled) {
                    setShowLyrics(!showLyrics);
                    if (!showLyrics && setShowQueue) {
                      setShowQueue(false);
                    }
                  }
                }}
                disabled={isLyricsDisabled}
                className={`hidden md:flex items-center justify-center transition-colors ${isLyricsDisabled ? 'text-white/20 cursor-not-allowed' : showLyrics ? 'text-[var(--theme-color)] cursor-pointer' : 'text-white/40 hover:text-white cursor-pointer'}`}
                title={tooltipText}
              >
                <Mic2 className="w-4 h-4" />
              </button>
            );
          })()}

          {currentSong.commentKey && currentSong.commentTracker && (
            <button
              onClick={() => setShowComments(true)}
              className="hidden md:flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Comments"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}

          <div
            className="hidden lg:flex items-center gap-2 w-24 group relative"
            title={`${Math.round(volume * 100)}%`}
          >
            <Volume2 className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
            <div
              ref={volumeRef}
              className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer"
              onMouseDown={(e) => {
                setIsDraggingVolume(true);
                handleVolumeClick(e);
              }}
              onWheel={handleVolumeWheel}
            >
              <div
                className="h-full bg-white transition-all duration-100 ease-linear group-hover:bg-white"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>

          {allowFullScreen && (
            <button onClick={onFullScreen} className="text-white/40 hover:text-white transition-colors cursor-pointer">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              setShowMenu(false);
              if (setShowQueue) setShowQueue(false);
              setShowLyrics(false);
              onClose();
            }}
            className="text-white/40 hover:text-white transition-colors cursor-pointer"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                if (!showMenu) {
                  if (setShowQueue) setShowQueue(false);
                  setShowLyrics(false);
                }
                setShowMenu(!showMenu);
              }}
              className="text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="absolute bottom-full right-0 mb-4 w-48 bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl overflow-hidden py-1 z-50"
                >
                  {(() => {
                    const isLyricsDisabled = currentSong.name.includes('???') || currentSong.name.toLowerCase().includes('remix') || currentSong.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');
                    const tooltipText = currentSong.name.includes('???') ? "Song has no name" : isLyricsDisabled ? "Lyrics unavailable for remixes" : "Lyrics";
                    
                    return (
                      <>
                        <button
                          onClick={() => {
                            if (showLyrics) setShowLyrics(false);
                            if (setShowQueue) setShowQueue(!showQueue);
                            else onShowQueue?.();
                            setShowMenu(false);
                          }}
                          className="md:hidden w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-white/70 hover:text-white hover:bg-white/5 cursor-pointer"
                          title="Queue"
                        >
                          <ListMusic className="w-4 h-4" /> Queue
                        </button>
                        <button
                          onClick={() => {
                            if (!isLyricsDisabled) {
                              setShowLyrics(!showLyrics);
                              if (setShowQueue) setShowQueue(false);
                              setShowMenu(false);
                            }
                          }}
                          disabled={isLyricsDisabled}
                          className={`md:hidden w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${isLyricsDisabled ? 'text-white/20 cursor-not-allowed' : 'text-white/70 hover:text-white hover:bg-white/5 cursor-pointer'}`}
                          title={tooltipText}
                        >
                          <Mic2 className="w-4 h-4" /> {tooltipText}
                        </button>
                        {currentSong.commentKey && currentSong.commentTracker && (
                          <button
                            onClick={() => { setShowComments(true); setShowMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                          >
                            <MessageCircle className="w-4 h-4" /> Comments
                          </button>
                        )}
                        {toggleFavorite &&
                          currentSong.name !== "Alright but the beat is Father Stretch My Hands Pt. 1" &&
                          !currentSong.name.endsWith('[Fake Leak]') &&
                          !(era?.name || '').includes('Fake') &&
                          !currentSong.name.endsWith('[Stems]') &&
                          !(era?.name || '').includes('Stems') &&
                          !currentSong.name.endsWith('[Misc]') &&
                          !(era?.name || '').includes('Misc') && (
                          <button
                            onClick={() => {
                              toggleFavorite();
                              setShowMenu(false);
                            }}
                            className="md:hidden w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors cursor-pointer hover:bg-white/5"
                            style={{ color: isFavorite ? 'var(--theme-color)' : undefined }}
                          >
                            <Star className={`w-4 h-4 ${isFavorite ? 'fill-[var(--theme-color)] text-[var(--theme-color)]' : 'text-white/70'}`} />
                            <span className={isFavorite ? '' : 'text-white/70'}>{isFavorite ? 'Unfavorite' : 'Favorite'}</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowPlaylistMenu(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  <ListMusic className="w-4 h-4" /> Add to Playlist
                </button>
                <button
                  onClick={handleShare}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  <Share2 className="w-4 h-4" /> Share Song
                </button>
                {downloadUrl && allowDownload && (
                  <button onClick={() => {
                        const dlEraName = (currentSong as any).realEra?.name || era?.name || '';
                        const dlArtUrl = currentSong.image || CUSTOM_IMAGES[dlEraName] || (currentSong as any).realEra?.image || era?.image;
                        const dlYear = ALBUM_RELEASE_DATES[dlEraName]?.split('/').pop();
                        handleDownloadFile(rawUrl, buildDownloadName(currentSong.name, settings.tagFeaturedArtists, settings.tagsAsEmojis), settings.tagsAsEmojis, settings.embedMetadata ? {
                          title: buildTitleTag(currentSong.name, settings.tagFeaturedArtists),
                          artist: buildArtistTag(currentSong.name, dlEraName, settings.tagFeaturedArtists),
                          album: dlEraName,
                          year: dlYear,
                          artworkUrl: dlArtUrl,
                        } : undefined, settings.downloadAsOgFilename ? currentSong.description : undefined, settings.convertToMp3);
                        setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left">
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                {rawUrl && looksLikeRealLink(rawUrl) && (
                  <a
                    href={rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" /> Visit Original Link
                  </a>
                )}
                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (setShowQueue) setShowQueue(false);
                    setShowLyrics(false);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" /> Close Player
                </button>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </motion.div>

      <LyricsModal
        isOpen={showLyrics}
        onClose={() => setShowLyrics(false)}
        currentSong={currentSong}
        era={era}
        currentTime={currentTime}
        onSeek={onSeek}
      />

      {currentSong.commentKey && currentSong.commentTracker && (
        <CommentsModal
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          tracker={currentSong.commentTracker}
          entryKey={currentSong.commentKey}
          entryLabel={currentSong.commentLabel || currentSong.name}
          entryType="song"
        />
      )}

      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 text-white text-sm px-4 py-2 rounded-full shadow-xl z-[200]"
          >
            {shareToast}
          </motion.div>
        )}
      </AnimatePresence>

      {showPlaylistMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => { setShowPlaylistMenu(false); setCreatingPlaylist(false); setNewPlaylistName(''); }} />
          <motion.div
            ref={playlistMenuRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-24 md:bottom-28 right-4 md:right-8 z-[100] w-56 bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl overflow-hidden py-1"
          >
            {playlists.length === 0 && !creatingPlaylist && (
              <div className="px-4 py-2 text-xs text-white/40">No playlists yet</div>
            )}
            {playlists.map(p => {
              const inPlaylist = p.songs.some(s => s.songName === currentSong.name && s.url === rawUrl);
              return (
                <button
                  key={p.id}
                  onClick={() => handleAddToPlaylist(p.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Check className={`w-3.5 h-3.5 shrink-0 ${inPlaylist ? 'text-[var(--theme-color)]' : 'opacity-0'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
            {creatingPlaylist ? (
              <div className="p-2 border-t border-white/10">
                <input
                  ref={newPlaylistInputRef}
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreatePlaylist();
                    if (e.key === 'Escape') { setCreatingPlaylist(false); setNewPlaylistName(''); }
                  }}
                  placeholder="Playlist name..."
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={handleCreatePlaylist}
                    className="flex-1 text-xs py-1 rounded bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setCreatingPlaylist(false); setNewPlaylistName(''); }}
                    className="flex-1 text-xs py-1 rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreatingPlaylist(true)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/50 hover:text-white hover:bg-white/5 transition-colors ${playlists.length > 0 ? 'border-t border-white/10' : ''}`}
              >
                <Plus className="w-3.5 h-3.5" />
                New playlist...
              </button>
            )}
          </motion.div>
        </>,
        document.body
      )}
    </>
  );
}
