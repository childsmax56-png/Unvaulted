// "For You" — a YouTube Shorts–style vertical feed of song recommendations
// drawn from the signed-in user's listening history (see recommendations.ts).
//
// Full-screen, one song per panel, scroll-snap between them. The panel in view
// autoplays through the global audio engine (audioStore), so playback, the
// lock-screen media session, and next/prev all work exactly like everywhere
// else — the feed just drives which index is active. When a track ends the
// store advances the index; we listen for that and scroll the feed to match.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Play, Pause, ChevronDown, RefreshCw, Sparkles, ExternalLink, Music2 } from 'lucide-react';
import * as audioStore from './player/audioStore';
import { buildRecommendations, RecSong } from './recommendations';
import { isListeningLoggedIn } from './listening';
import { Img } from './utils';

const ACCENT = '#7C5CFF';

export function ForYouPage() {
  const navigate = useNavigate();
  const audio = audioStore.useAudioState();

  const [songs, setSongs] = useState<RecSong[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_signed_in' | 'no_history'>('loading');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  // The exact array reference handed to the audio store — lets us tell whether
  // the currently-playing queue is *our* feed (vs. music started elsewhere).
  const songsRef = useRef<RecSong[]>([]);
  // Autoplay-on-scroll only kicks in after the first user gesture (browsers
  // block audio.play() without one). Before that, the first card waits for a tap.
  const startedRef = useRef(false);
  const activeIndexRef = useRef(0);

  const load = useCallback(async () => {
    setStatus('loading');
    const result = await buildRecommendations();
    if (result.reason === 'not_signed_in') { setStatus('not_signed_in'); return; }
    if (result.songs.length === 0) { setStatus('no_history'); return; }
    songsRef.current = result.songs;
    setSongs(result.songs);
    setActiveIndex(0);
    activeIndexRef.current = 0;
    startedRef.current = false;
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!isListeningLoggedIn()) { setStatus('not_signed_in'); return; }
    void load();
  }, [load]);

  const isOurQueue = audio.playlist === songsRef.current && songsRef.current.length > 0;

  // Play a specific card through the global engine.
  const playIndex = useCallback((i: number) => {
    const list = songsRef.current;
    const song = list[i];
    if (!song) return;
    startedRef.current = true;
    void audioStore.playSongList(list as any, i, song.realEra as any);
  }, []);

  // Tap the active card → toggle; tap another → jump to it.
  const onCardTap = useCallback((i: number) => {
    if (isOurQueue && audio.currentSongIndex === i) {
      audioStore.togglePlay();
    } else {
      playIndex(i);
    }
  }, [isOurQueue, audio.currentSongIndex, playIndex]);

  // Which panel is centred in the viewport = the active card. Autoplay it once
  // the user has interacted at least once.
  useEffect(() => {
    if (status !== 'ready') return;
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(idx)) continue;
          setActiveIndex(idx);
          activeIndexRef.current = idx;
          if (startedRef.current && !(audio.playlist === songsRef.current && audio.currentSongIndex === idx)) {
            playIndex(idx);
          }
        }
      },
      { root, threshold: [0.6] }
    );
    for (const el of panelRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
    // Re-observe when the feed changes; audio deps intentionally read live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, songs, playIndex]);

  // Record the first gesture so scroll-driven autoplay can start.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || status !== 'ready') return;
    const mark = () => { startedRef.current = true; };
    root.addEventListener('pointerdown', mark, { passive: true });
    root.addEventListener('wheel', mark, { passive: true });
    root.addEventListener('touchstart', mark, { passive: true });
    return () => {
      root.removeEventListener('pointerdown', mark);
      root.removeEventListener('wheel', mark);
      root.removeEventListener('touchstart', mark);
    };
  }, [status]);

  // When the store advances on its own (a track ended → next), follow it in the
  // feed so the visible card matches what's playing.
  useEffect(() => {
    if (!isOurQueue) return;
    const idx = audio.currentSongIndex;
    if (idx < 0 || idx === activeIndexRef.current) return;
    const el = panelRefs.current[idx];
    if (el) {
      activeIndexRef.current = idx;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [audio.currentSongIndex, isOurQueue]);

  const goNext = useCallback(() => {
    const next = Math.min(activeIndexRef.current + 1, songsRef.current.length - 1);
    const el = panelRefs.current[next];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ---- Non-feed states -----------------------------------------------------
  if (status !== 'ready') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <TopBar onHome={() => navigate('/')} onRefresh={load} refreshable={false} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          {status === 'loading' && (
            <>
              <Sparkles className="w-10 h-10 animate-pulse" style={{ color: ACCENT }} />
              <p className="text-white/60 text-sm">Building your feed from what you’ve been playing…</p>
            </>
          )}
          {status === 'not_signed_in' && (
            <>
              <Music2 className="w-10 h-10 text-white/30" />
              <p className="text-white/70 text-sm max-w-sm">Sign in and play a few songs — For You builds an endless feed from the eras you actually listen to.</p>
              <button onClick={() => navigate('/')} className="mt-1 px-5 py-2 rounded-full text-sm font-semibold cursor-pointer" style={{ background: `${ACCENT}22`, color: ACCENT }}>Go home</button>
            </>
          )}
          {status === 'no_history' && (
            <>
              <Music2 className="w-10 h-10 text-white/30" />
              <p className="text-white/70 text-sm max-w-sm">No listening history yet. Play some music (or import from Last.fm on <span style={{ color: ACCENT }}>Your Listening</span>) and come back.</p>
              <div className="flex gap-3">
                <button onClick={() => navigate('/listening')} className="px-5 py-2 rounded-full bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10 cursor-pointer">Your Listening</button>
                <button onClick={load} className="px-5 py-2 rounded-full text-sm font-semibold cursor-pointer" style={{ background: `${ACCENT}22`, color: ACCENT }}>Retry</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- The feed ------------------------------------------------------------
  return (
    <div className="bg-black text-white" style={{ height: '100dvh', overflow: 'hidden' }}>
      <div className="absolute top-0 left-0 right-0 z-30">
        <TopBar onHome={() => navigate('/')} onRefresh={load} refreshable />
      </div>

      <div
        ref={containerRef}
        className="hide-scrollbar"
        style={{ height: '100dvh', overflowY: 'scroll', scrollSnapType: 'y mandatory' }}
      >
        {songs.map((song, i) => {
          const isCurrent = isOurQueue && audio.currentSongIndex === i;
          const playing = isCurrent && audio.isPlaying;
          return (
            <div
              key={`${song.tracker}-${song.name}-${i}`}
              data-index={i}
              ref={(el) => { panelRefs.current[i] = el; }}
              style={{ height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always', position: 'relative' }}
              className="flex items-center justify-center overflow-hidden"
            >
              {/* Blurred cover backdrop */}
              {song.image && (
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${song.image})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(48px) brightness(0.4)', transform: 'scale(1.2)',
                  }}
                />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 35%, rgba(0,0,0,0.85) 100%)' }} />

              {/* Foreground */}
              <div className="relative z-10 flex flex-col items-center text-center px-6 w-full max-w-md">
                <button
                  onClick={() => onCardTap(i)}
                  className="group relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
                  style={{ width: 'min(74vw, 340px)', aspectRatio: '1 / 1', border: '1px solid rgba(255,255,255,0.1)' }}
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {song.image
                    ? <Img w={500} src={song.image} alt={song.name} className="w-full h-full object-cover" draggable={false} />
                    : <div className="w-full h-full flex items-center justify-center bg-white/5"><Music2 className="w-16 h-16 text-white/20" /></div>}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`} style={{ background: 'rgba(0,0,0,0.28)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.25)' }}>
                      {playing ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white translate-x-0.5" />}
                    </div>
                  </div>
                </button>

                <div className="mt-5 w-full">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3 text-[11px] font-semibold" style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }}>
                    <Sparkles className="w-3 h-3" /> {song.reason}
                  </div>
                  <h2 className="text-xl font-black tracking-tight leading-tight truncate">{song.name}</h2>
                  <p className="text-sm text-white/60 mt-1 truncate">{song.artist} • {song.eraName}</p>
                </div>
              </div>

              {/* Right-rail controls (Shorts style) */}
              <div className="absolute right-3 md:right-6 bottom-32 z-20 flex flex-col items-center gap-5">
                <RailButton label={playing ? 'Pause' : 'Play'} onClick={() => onCardTap(i)}>
                  {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 translate-x-0.5" />}
                </RailButton>
                <RailButton label="Next" onClick={goNext}>
                  <ChevronDown className="w-6 h-6" />
                </RailButton>
                <RailButton label="Open tracker" onClick={() => navigate(`/${song.tracker}`)}>
                  <ExternalLink className="w-5 h-5" />
                </RailButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopBar({ onHome, onRefresh, refreshable }: { onHome: () => void; onRefresh: () => void; refreshable: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 md:px-8 py-4" style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 0.5rem))' }}>
      <button onClick={onHome} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm cursor-pointer transition-colors" title="Home">
        <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
      </button>
      <h1 className="text-lg md:text-xl font-black tracking-tight ml-1 flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: ACCENT }} /> For You
      </h1>
      {refreshable && (
        <button onClick={onRefresh} className="ml-auto flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-semibold uppercase tracking-wider cursor-pointer" title="Refresh recommendations">
          <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
        </button>
      )}
    </div>
  );
}

function RailButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="flex flex-col items-center gap-1 text-white/90 hover:text-white cursor-pointer">
      <span className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-colors" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
        {children}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
