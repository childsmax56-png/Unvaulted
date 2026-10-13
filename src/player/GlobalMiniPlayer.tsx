// Route-independent mini player. Renders on any route where the per-artist
// <App> is not mounted (e.g. the landing page) so audio playback stays visible
// and controllable while the user browses between artists / the homepage.
//
// It reads and drives the shared audioStore directly, so it needs none of the
// per-artist React contexts. On artist routes App renders its own full-featured
// PlayerBar instead, and this component hides itself.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, X, ChevronUp, Maximize2 } from 'lucide-react';
import * as audioStore from './audioStore';
import { parseArtistFromSong } from '../lastfm';
import { CUSTOM_IMAGES, formatTextWithTags, Img } from '../utils';
import { CommentButton } from '../components/CommentButton';
import { FullScreenPlayer } from '../components/FullScreenPlayer';
import { Era } from '../types';

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GlobalMiniPlayer() {
  const state = audioStore.useAudioState();
  const [closed, setClosed] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { currentSong, currentEra, activePlayer, isPlaying, currentTime, duration, volume, isShuffle, loopMode, currentArtwork, currentArtistLabel, playlist, currentSongIndex, shuffledQueue } = state;

  // Only responsible for the persistent HTML5-audio playback. Embedded players
  // (Spotify/YouTube/SoundCloud) are tied to App and stop on navigation.
  if (activePlayer !== 'audio' || !currentSong) return null;

  const actualEraName = (currentSong as any).realEra?.name || currentEra?.name || '';
  // Prefer the artwork/artist resolved at play time (under the song's own
  // artist config); fall back to live resolution only if unset.
  const imgUrl = currentArtwork || currentSong.image || CUSTOM_IMAGES[actualEraName] || (currentSong as any).realEra?.image || currentEra?.image;
  const titleDisplay = currentSong.name.includes(' - ')
    ? currentSong.name.substring(currentSong.name.indexOf(' - ') + 3)
    : currentSong.name;
  const artistName = currentArtistLabel || parseArtistFromSong(currentSong.name, currentSong.extra, actualEraName);
  const progress = duration ? (currentTime / duration) * 100 : 0;

  const seekFromClientX = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (duration) audioStore.seek(ratio * duration);
  };

  const nextSong = playlist.length > 0 ? playlist[(currentSongIndex + 1) % playlist.length] : null;

  return createPortal(
    <>
    <AnimatePresence>
      {expanded && currentSong && (
        <FullScreenPlayer
          currentSong={currentSong}
          nextSong={nextSong}
          isPlaying={isPlaying}
          togglePlay={audioStore.togglePlay}
          onClose={() => setExpanded(false)}
          era={currentEra}
          currentTime={currentTime}
          duration={duration}
          onSeek={audioStore.seek}
          audioRef={audioStore.audioRef as { current: HTMLAudioElement | null }}
          onNext={audioStore.playNext}
          onPrev={audioStore.playPrev}
          isShuffle={isShuffle}
          toggleShuffle={audioStore.toggleShuffle}
          loopMode={loopMode}
          toggleLoop={audioStore.cycleLoop}
          playlist={playlist}
          currentSongIndex={currentSongIndex}
          shuffledQueue={shuffledQueue}
          volume={volume}
          onVolumeChange={audioStore.setVolume}
          artworkOverride={currentArtwork || undefined}
          artistOverride={currentArtistLabel || undefined}
          onPlaySong={(idx) => {
            const target = playlist[idx];
            if (!target) return;
            const eraToPass = ((target as any).realEra || currentEra) as Era;
            void audioStore.playSongList(playlist, idx, eraToPass);
          }}
        />
      )}
    </AnimatePresence>
    <AnimatePresence>
      {closed ? (
        <motion.button
          key="restore"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setClosed(false)}
          className="fixed right-6 z-[60] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform drop-shadow-2xl bg-transparent border-0 p-0"
          style={{ bottom: 'calc(100vh - 100dvh + 1.5rem)' }}
          title="Show player"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 2000 2000">
            <circle fill="#222" stroke="rgba(255,255,255,0.15)" strokeWidth="80" cx="1000.5" cy="1000.5" r="890.5" />
            <g transform="translate(1000.5, 1020)">
              <path stroke="white" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M -250 125 L 0 -125 L 250 125" />
            </g>
          </svg>
        </motion.button>
      ) : (
        <motion.div
          key="bar"
          initial={{ y: 100, opacity: 0, filter: 'blur(10px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: 100, opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 pt-4 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] md:pt-0 md:pb-0 md:h-24 bg-black/70 md:bg-black/60 backdrop-blur-3xl md:backdrop-blur-2xl border-t border-white/10 z-[60] grid grid-cols-[1fr_auto] md:flex items-center px-5 md:px-6 gap-y-5 gap-x-0 md:gap-0 rounded-t-3xl md:rounded-none shadow-[0_-12px_40px_rgba(0,0,0,0.55)] md:shadow-none"
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setExpanded(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } }}
            className="group flex items-center gap-4 min-w-0 md:flex-1 col-start-1 col-end-2 row-start-1 pr-4 md:pr-0 cursor-pointer"
            title="Open full screen player"
          >
            <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-white/10 relative shadow-lg">
              {imgUrl && (
                <Img w={120} eager src={imgUrl} alt="Cover" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold break-words whitespace-normal leading-tight text-sm md:text-base pr-2">{formatTextWithTags(titleDisplay)}</div>
              <div className="text-white/50 text-xs truncate mt-0.5">{artistName} • {formatTextWithTags(currentSong.extra || (currentSong as any).realEra?.name || currentEra?.name)}</div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center col-span-2 row-start-2 md:col-auto md:row-auto md:flex-[2] w-full px-1 md:px-4">
            <div className="flex items-center justify-between md:justify-center w-full md:w-auto gap-4 md:gap-6 mb-3 md:mb-2 px-2 md:px-0">
              <button onClick={audioStore.toggleShuffle} className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${isShuffle ? 'text-white' : 'text-white/40 hover:text-white/80'}`} title="Shuffle">
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={audioStore.playPrev} className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer" title="Previous">
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button onClick={audioStore.togglePlay} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shrink-0 shadow-lg cursor-pointer" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              <button onClick={audioStore.playNext} className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer" title="Next">
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button onClick={audioStore.cycleLoop} className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${loopMode !== 0 ? 'text-white' : 'text-white/40 hover:text-white/80'}`} title="Repeat">
                {loopMode === 1 ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>
            <div className="w-full flex items-center gap-3 px-2 md:px-0 text-[10px] font-mono text-white/50">
              <span className="w-8 text-right">{formatTime(currentTime)}</span>
              {/* Tall, transparent hit area for easy tapping/scrubbing on touch;
                  pointer events cover both mouse and touch (fixes "can't fast
                  forward on the homepage"). */}
              <div
                className="flex-1 py-2 -my-2 cursor-pointer relative flex items-center"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setSeeking(true);
                  seekFromClientX(e.clientX, e.currentTarget);
                }}
                onPointerMove={(e) => { if (seeking) seekFromClientX(e.clientX, e.currentTarget); }}
                onPointerUp={(e) => { setSeeking(false); e.currentTarget.releasePointerCapture?.(e.pointerId); }}
                onPointerCancel={() => setSeeking(false)}
              >
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                  <div className="absolute top-0 left-0 h-full bg-white transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <span className="w-8">{duration ? formatTime(duration) : (currentSong.track_length || '0:00')}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 md:gap-4 col-start-2 col-end-3 row-start-1 md:flex-1">
            {currentSong.commentKey && currentSong.commentTracker && (
              <CommentButton
                tracker={currentSong.commentTracker}
                entryKey={currentSong.commentKey}
                entryLabel={currentSong.commentLabel || titleDisplay}
                entryType="song"
                className="!p-0 w-8 h-8 justify-center text-white/50 hover:text-white"
              />
            )}
            <div className="hidden md:flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-white/50" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => audioStore.setVolume(parseFloat(e.target.value))}
                className="w-24 accent-white cursor-pointer"
                title="Volume"
              />
            </div>
            <button onClick={() => setExpanded(true)} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer" title="Full screen player">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={() => setClosed(true)} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer" title="Hide player">
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>,
    document.body,
  );
}
