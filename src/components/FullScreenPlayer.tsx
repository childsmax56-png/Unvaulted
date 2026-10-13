import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, X, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Mic2, Loader2, AlignLeft, Clock, ListMusic, Volume2, ExternalLink } from 'lucide-react';
import { parseArtistFromSong, cleanTrackName } from '../lastfm';
import { Song, Era } from '../types';
import { useEffect, useRef, useState } from 'react';
import { formatTextWithTags, getCleanSongNameWithTags, CUSTOM_IMAGES, parseNoteDescription, ERA_THEMES , Img, looksLikeRealLink} from '../utils';
import { useLyrics } from '../useLyrics';

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

import { useSettings } from '../SettingsContext';

export function FullScreenPlayer({
  currentSong, nextSong, isPlaying, togglePlay, onClose, era, currentTime = 0, duration = 0, onSeek, audioRef, analyserRef,
  onNext, onPrev, isShuffle, toggleShuffle, loopMode, toggleLoop, onShowQueue, playlist, currentSongIndex, shuffledQueue, onPlaySong,
  volume = 1, onVolumeChange, artworkOverride, artistOverride
}: {
  currentSong: Song, nextSong?: Song | null, isPlaying: boolean, togglePlay: () => void, onClose: () => void, era: Era | null, currentTime?: number, duration?: number, onSeek?: (time: number) => void, audioRef?: React.RefObject<HTMLAudioElement | null>, analyserRef?: React.RefObject<AnalyserNode | null>,
  onNext?: () => void, onPrev?: () => void, isShuffle?: boolean, toggleShuffle?: () => void, loopMode?: number, toggleLoop?: () => void,
  onShowQueue?: () => void, playlist?: Song[], currentSongIndex?: number, shuffledQueue?: number[], onPlaySong?: (idx: number) => void,
  volume?: number, onVolumeChange?: (vol: number) => void,
  // Resolved under the song's own artist config; win over live lookups so a
  // persisted song keeps its cover/artist while viewing another artist.
  artworkOverride?: string, artistOverride?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [viewMode, setViewMode] = useState<'sync' | 'plain'>('sync');
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const { plainLyrics, parsedSyncedLyrics, source, loading, error } = useLyrics(currentSong, era);
  const { settings } = useSettings();

  const hasSynced = !!parsedSyncedLyrics && parsedSyncedLyrics.length > 0;
  
  const showNextNotification = settings.showNextSongNotification && nextSong && duration > 0 && (duration - currentTime) <= 10 && (duration - currentTime) > 5;

  const [showMoreQueue, setShowMoreQueue] = useState(false);
  const upcomingQueue: {song: Song, realIndex: number, queueId: string}[] = [];
  const INITIAL_SHOW_COUNT = 15;

  if (playlist && currentSongIndex !== undefined) {
    if (loopMode === 2) {
      for (let i = 0; i < 30; i++) {
        upcomingQueue.push({ song: playlist[currentSongIndex], realIndex: currentSongIndex, queueId: `repeat-${currentSongIndex}-${i}` });
      }
    } else {
      let nextIndices: number[] = [];
      if (isShuffle && shuffledQueue && shuffledQueue.length > 0) {
        const curIdx = shuffledQueue.indexOf(currentSongIndex);
        if (curIdx !== -1) {
          nextIndices = shuffledQueue.slice(curIdx + 1);
          if (loopMode === 1 && nextIndices.length === 0) {
            nextIndices = shuffledQueue;
          }
        }
      } else {
        nextIndices = playlist.map((_, i) => i).slice(currentSongIndex + 1);
        if (loopMode === 1 && nextIndices.length === 0) {
          nextIndices = playlist.map((_, i) => i);
        }
      }

      for (const idx of nextIndices) {
        if (playlist[idx]) {
          upcomingQueue.push({ song: playlist[idx], realIndex: idx, queueId: `normal-${idx}` });
        }
      }
    }
  }

  const displayedQueue = showMoreQueue ? upcomingQueue : upcomingQueue.slice(0, INITIAL_SHOW_COUNT);

  useEffect(() => {
    const handleToggleLyrics = () => {
      const isLyricsDisabled = currentSong.name.includes('???') || currentSong.name.toLowerCase().includes('remix') || currentSong.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');
      if (!isLyricsDisabled) {
        setShowLyrics(prev => !prev);
      }
    };

    window.addEventListener('toggle-lyrics', handleToggleLyrics);
    return () => window.removeEventListener('toggle-lyrics', handleToggleLyrics);
  }, [currentSong, era]);

  useEffect(() => {
    if (!loading && !hasSynced && plainLyrics && !settings.syncedLyricsOnly) {
      setViewMode('plain');
    } else if (!loading && hasSynced) {
      setViewMode('sync');
    }
  }, [hasSynced, plainLyrics, loading, settings.syncedLyricsOnly]);

  const currentLineIndex = parsedSyncedLyrics 
    ? parsedSyncedLyrics.findIndex((line, i) => {
        const nextLine = parsedSyncedLyrics[i + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
      })
    : -1;

  useEffect(() => {
    if (showLyrics && viewMode === 'sync' && parsedSyncedLyrics && currentLineIndex !== -1 && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeElement = container.querySelector(`[data-index="${currentLineIndex}"]`) as HTMLElement;
      if (activeElement) {
        const containerHalfHeight = container.clientHeight / 2;
        const elementOffset = activeElement.offsetTop;
        const elementHalfHeight = activeElement.clientHeight / 2;
        container.scrollTo({
          top: elementOffset - containerHalfHeight + elementHalfHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [currentLineIndex, showLyrics, viewMode, parsedSyncedLyrics]);

  useEffect(() => {
    if (currentSong || era) {
      const isLyricsDisabled = currentSong?.name.includes('???') || currentSong?.name.toLowerCase().includes('remix') || currentSong?.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');
      if (isLyricsDisabled && showLyrics) {
        setShowLyrics(false);
      }
    }
  }, [currentSong, era, showLyrics]);

  const volumeRef = useRef<HTMLDivElement>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress && progressRef.current && onSeek && duration) {
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(percent * duration);
      }
      if (isDraggingVolume && volumeRef.current && onVolumeChange) {
        const rect = volumeRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onVolumeChange(percent);
      }
    };

    if (isDraggingProgress || isDraggingVolume) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProgress, isDraggingVolume, onSeek, duration, onVolumeChange]);

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onVolumeChange || !volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onVolumeChange(percent);
  };

  const handleVolumeWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!onVolumeChange || volume === undefined) return;
    const delta = e.deltaY;
    const step = 0.05;
    let newVolume = volume;
    if (delta > 0) {
      newVolume = Math.max(0, volume - step);
    } else if (delta < 0) {
      newVolume = Math.min(1, volume + step);
    }
    onVolumeChange(newVolume);
  };

  useEffect(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    }

    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn(`Error attempting to exit fullscreen: ${err.message}`);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!audioRef?.current || !isPlaying || !analyserRef?.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyzer = analyserRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        ctx.fillStyle = `rgba(255, 255, 255, ${barHeight / 150})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, audioRef, analyserRef]);

  const artistName = artistOverride || parseArtistFromSong(currentSong.name, currentSong.extra, (currentSong as any).realEra?.name || era?.name);
  const titleDisplay = currentSong.name.includes(' - ') ? currentSong.name.substring(currentSong.name.indexOf(' - ') + 3) : currentSong.name;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !duration || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  };

  const isLyricsDisabled = currentSong.name.includes('???') || currentSong.name.toLowerCase().includes('remix') || currentSong.extra?.toLowerCase().includes('remix') || era?.name.toLowerCase().includes('remix');

  const rawUrl = currentSong.url || (currentSong.urls && currentSong.urls.length > 0 ? currentSong.urls[0] : '');
  const originalLinkUrl = rawUrl && looksLikeRealLink(rawUrl) ? rawUrl : null;

  const actualEraName = (currentSong as any).realEra?.name || era?.name || '';
  const currentImgUrl = artworkOverride || currentSong.image || CUSTOM_IMAGES[actualEraName] || (currentSong as any).realEra?.image || era?.image;
  
  const nextActualEraName = nextSong ? ((nextSong as any).realEra?.name || era?.name || '') : '';
  const nextImgUrl = nextSong ? (nextSong.image || CUSTOM_IMAGES[nextActualEraName] || (nextSong as any).realEra?.image || era?.image) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%', filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: '100%', filter: 'blur(10px)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-yzy-black flex flex-col"
      style={!settings.disableEraThemes && ERA_THEMES[era?.name ?? '']?.fullPicturePlayer ? {
        backgroundImage: `url(${ERA_THEMES[era!.name].fullPicturePlayer})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {currentImgUrl && <Img w={400} eager src={currentImgUrl} alt="" className="w-full h-full object-cover opacity-10 blur-3xl scale-110" />}
      </div>

      <div
        className="relative z-10 px-4 md:px-6 pb-4 md:pb-6 flex justify-between items-center gap-2"
        style={{ paddingTop: 'max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem))' }}
      >
        <div className="w-10 md:w-24 shrink-0 relative">
          <AnimatePresence>
            {showNextNotification && nextSong && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="absolute top-0 left-0 hidden md:flex items-center gap-5 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl w-96 z-50"
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-white/10 shadow-lg">
                  {nextImgUrl && <Img w={600} src={nextImgUrl} alt="Next Cover" className="w-full h-full object-cover" />}
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--theme-color)] mb-1.5">Next Song</span>
                  <span className="text-lg font-bold text-white truncate">{cleanTrackName(nextSong.name, undefined, true, false, false)}</span>
                  <span className="text-sm text-white/60 truncate mt-0.5">{parseArtistFromSong(nextSong.name, nextSong.extra, (nextSong as any).realEra?.name || era?.name)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="text-center flex-1 min-w-0 px-1">
          <h3 className="text-white/60 text-sm font-medium uppercase tracking-widest truncate">{(currentSong as any).realEra?.name || era?.name}</h3>
          <p className="text-white/40 text-xs mt-1 truncate">
            {currentSong.quality || 'Unknown Quality'}
            {currentSong.available_length && ` • ${currentSong.available_length}`}
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0 justify-end">
          {showLyrics && hasSynced && plainLyrics && !isLyricsDisabled && !settings.syncedLyricsOnly && (
            <div className="flex items-center bg-white/10 rounded-full p-0.5 mr-2">
              <button
                onClick={() => setViewMode('sync')}
                className={`p-1.5 rounded-full transition-colors ${viewMode === 'sync' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
                title="Synced Lyrics"
              >
                <Clock className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('plain')}
                className={`p-1.5 rounded-full transition-colors ${viewMode === 'plain' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
                title="Plain Text"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
            </div>
          )}
          <button 
            onClick={() => {
              setShowQueue(!showQueue);
              if (!showQueue) setShowLyrics(false);
            }}
            className={`w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 ${showQueue ? 'text-[var(--theme-color)]' : 'text-white'}`}
            title="Queue"
          >
            <ListMusic className="w-5 h-5" />
          </button>
          {!isLyricsDisabled && (
            <button 
              onClick={() => {
                setShowLyrics(!showLyrics);
                if (!showLyrics) setShowQueue(false);
              }} 
              className={`w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 ${showLyrics ? 'text-[var(--theme-color)]' : 'text-white'}`}
              title="Lyrics"
            >
              <Mic2 className="w-5 h-5" />
            </button>
          )}
          {originalLinkUrl && (
            <a
              href={originalLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors shrink-0"
              title="Visit Original Link"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          )}
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className={`relative z-10 flex-1 flex items-center justify-center text-center px-6 overflow-hidden flex-col w-full`}>
        <AnimatePresence mode="wait">
          {showQueue ? (
            <motion.div
              key="queue"
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              className="w-full h-full flex flex-col justify-center items-center"
            >
              <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 py-8 custom-scrollbar text-left mask-image-y">
                <h2 className="text-xl font-bold text-white tracking-widest uppercase mb-8 text-center mt-20">Queue</h2>
                {upcomingQueue.length === 0 ? (
                  <div className="text-center text-white/50 py-12 text-sm uppercase tracking-widest font-mono">No upcoming songs</div>
                ) : (
                  <div className="flex flex-col gap-2 pb-32">
                    <AnimatePresence mode="popLayout">
                      {displayedQueue.map((item) => {
                        const itemEraName = (item.song as any).realEra?.name || era?.name || '';
                        const itemImgUrl = item.song.image || CUSTOM_IMAGES[itemEraName] || (item.song as any).realEra?.image || era?.image;
                        return (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, filter: 'blur(8px)', y: 20 }}
                          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                          exit={{ opacity: 0, filter: 'blur(8px)' }}
                          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                          key={item.queueId} 
                          className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                        <div className="w-12 h-12 rounded overflow-hidden bg-white/5 shrink-0 relative group-hover:block transition-all shadow-lg border border-white/5">
                          {itemImgUrl && (
                            <Img w={100} src={itemImgUrl} alt="" className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => {
                              onPlaySong?.(item.realIndex);
                              setShowQueue(false);
                            }}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                          >
                            <Play className="w-6 h-6 text-white fill-white" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg text-white font-bold truncate leading-tight" dangerouslySetInnerHTML={{ __html: getCleanSongNameWithTags(item.song.name) }} />
                          <div className="text-sm text-white/50 font-medium truncate mt-0.5">
                            {item.song.extra || (item.song as any).realEra?.name || era?.name || ''}
                          </div>
                        </div>
                        {item.song.track_length && (
                          <div className="text-sm font-mono text-white/40 shrink-0">
                            {item.song.track_length}
                          </div>
                        )}
                        </motion.div>
                        );
                    })}
                    </AnimatePresence>
                    
                    {!showMoreQueue && upcomingQueue.length > INITIAL_SHOW_COUNT && (
                      <button
                        onClick={() => setShowMoreQueue(true)}
                        className="w-full py-4 mt-6 text-xs font-bold tracking-widest uppercase text-white/50 hover:text-white hover:bg-white/10 transition-colors rounded-xl border border-white/10"
                      >
                        Show More ({upcomingQueue.length - INITIAL_SHOW_COUNT} total)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : showLyrics && !isLyricsDisabled ? (
            <motion.div
              key="lyrics"
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full h-full flex flex-col"
            >
              <div 
                ref={lyricsContainerRef}
                className="relative flex-1 overflow-y-auto custom-scrollbar px-4 py-12 mask-image-y"
                style={{ maskImage: viewMode === 'sync' ? 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' : 'none' }}
              >
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/50 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-color)]" />
                    <span className="text-lg font-medium">Searching lyrics...</span>
                  </div>
                ) : error ? (
                  <div className="h-full flex items-center justify-center text-white/50 text-center text-lg font-medium">
                    {error}
                  </div>
                ) : viewMode === 'sync' && parsedSyncedLyrics ? (
                  <div className="flex flex-col gap-6 py-32 text-center">
                    {parsedSyncedLyrics.map((line, i) => {
                      const isActive = i === currentLineIndex;
                      const isPassed = i < currentLineIndex;
                      
                      let fontSizeClass = 'text-2xl md:text-4xl lg:text-5xl';
                      if (settings.globalFontSize === 'small') fontSizeClass = 'text-xl md:text-2xl lg:text-3xl';
                      if (settings.globalFontSize === 'large') fontSizeClass = 'text-3xl md:text-5xl lg:text-6xl';

                      return (
                        <motion.div
                          key={i}
                          data-index={i}
                          onClick={() => onSeek && onSeek(line.time)}
                          animate={{
                            scale: isActive ? 1.05 : 1,
                            opacity: isActive ? 1 : isPassed ? 0.4 : 0.2,
                            y: isActive ? 0 : 0
                          }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          className={`${fontSizeClass} font-bold leading-tight transition-colors duration-500 cursor-pointer hover:opacity-80 ${isActive ? 'text-white' : 'text-white/50'}`}
                        >
                          {line.text || '♪'}
                        </motion.div>
                      );
                    })}
                    <div className="mt-12 text-sm text-white/30 uppercase tracking-widest">
                      Lyrics may not be accurate
                    </div>
                    <div className="mt-2 text-[10px] text-white/20 uppercase tracking-widest">
                      Sourced from {source === 'genius' ? 'Genius' : 'lrclib'}
                    </div>
                  </div>
                ) : settings.syncedLyricsOnly && !hasSynced ? (
                  <div className="h-full flex items-center justify-center text-white/50 text-center text-lg font-medium">
                    No synced lyrics available for this track.
                  </div>
                ) : plainLyrics ? (
                  <div className="flex flex-col py-12">
                    <div className="text-white/80 text-xl md:text-2xl leading-relaxed whitespace-pre-wrap font-medium text-center">
                      {plainLyrics}
                    </div>
                    <div className="mt-12 text-sm text-white/30 uppercase tracking-widest text-center">
                      Lyrics may not be accurate
                    </div>
                    <div className="mt-2 text-[10px] text-white/20 uppercase tracking-widest text-center">
                      Sourced from {source === 'genius' ? 'Genius' : 'lrclib'}
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`cover-${currentSong.name}`}
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
              className="flex flex-col items-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
                className="w-64 h-64 md:w-96 md:h-96 rounded-md overflow-hidden mb-10 shadow-2xl bg-white/5 relative"
              >
                {currentImgUrl && <Img w={800} eager src={currentImgUrl} alt="Cover" className="w-full h-full object-cover" />}

                <canvas
                  ref={canvasRef}
                  width={384}
                  height={384}
                  className="absolute bottom-0 left-0 w-full h-full pointer-events-none opacity-60 mix-blend-screen"
                />
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                className="text-3xl md:text-5xl font-bold text-white mb-2 px-4 break-words whitespace-normal leading-tight text-center"
              >
                {formatTextWithTags(titleDisplay)}
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                className="text-lg text-white/60 font-medium mb-1 break-words whitespace-normal px-4 text-center"
              >
                {artistName} • {formatTextWithTags(currentSong.extra || (currentSong as any).realEra?.name || era?.name)}
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                className="max-w-lg mx-auto text-center"
              >
                {(() => {
                  const { ogFilename, note } = parseNoteDescription(currentSong.description);
                  return (
                    <>
                      {note && <p className="text-white/40 text-sm">{formatTextWithTags(note)}</p>}
                      {ogFilename && <p className="text-white/25 text-xs font-mono mt-0.5">OG: {ogFilename}</p>}
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>

      <div className="relative z-10 p-8 md:p-12 flex flex-col items-center gap-8">
        <div className="w-full max-w-2xl flex flex-col items-center gap-4 text-xs font-mono text-white/50">
          {settings.fullScreenVolume && (
            <div
              className="hidden md:flex items-center gap-2 w-full max-w-[200px] group relative mb-4"
              title={`${Math.round((volume ?? 1) * 100)}%`}
            >
              <Volume2 className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
              <div
                ref={volumeRef}
                className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
                onMouseDown={(e) => {
                  setIsDraggingVolume(true);
                  handleVolumeClick(e);
                }}
                onWheel={handleVolumeWheel}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-white transition-all duration-100 ease-linear"
                  style={{ width: `${(volume ?? 1) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="w-full flex items-center gap-4">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
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
            <span className="w-10">{duration ? formatTime(duration) : (currentSong.track_length || '0:00')}</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <button onClick={toggleShuffle} className={`w-10 h-10 flex items-center justify-center transition-colors ${isShuffle ? 'text-white' : 'text-white/40 hover:text-white/80'}`}>
            <Shuffle className="w-5 h-5" />
          </button>
          <button onClick={onPrev} className="w-12 h-12 flex items-center justify-center text-white/80 hover:text-white transition-colors">
            <SkipBack className="w-8 h-8 fill-current" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-xl"
          >
            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>
          <button onClick={onNext} className="w-12 h-12 flex items-center justify-center text-white/80 hover:text-white transition-colors">
            <SkipForward className="w-8 h-8 fill-current" />
          </button>
          <button onClick={toggleLoop} className={`w-10 h-10 flex items-center justify-center transition-colors ${loopMode !== 0 ? 'text-white' : 'text-white/40 hover:text-white/80'}`}>
            {loopMode === 1 ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
