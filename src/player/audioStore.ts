// Global, route-independent audio playback engine.
//
// The per-artist <App> mounts with `key={artist}`, so navigating between
// artists (or to the landing page) unmounts and remounts it. When the audio
// element and playback state lived inside App, that remount destroyed the
// element and stopped the music. This module hoists the single <audio> element
// and all of its playback state into a module-level singleton that lives for
// the whole session, so a song keeps playing across navigation until the user
// picks a new one.
//
// App consumes this via `usePlayerField` (a drop-in useState replacement) and
// `audioRef`, so the existing playback code keeps working unchanged. A global
// mini-player (GlobalMiniPlayer) reads it directly so playback stays visible
// and controllable on routes where App is not mounted (e.g. the landing page).

import axios from 'axios';
import { useCallback, useSyncExternalStore } from 'react';
import type { Song, Era } from '../types';
import { parseArtistFromSong } from '../lastfm';
import { pixeldrainProxyBase, isChallengeGatedAudioHost } from '../utils';

export type ActivePlayer = 'audio' | 'spotify' | 'youtube' | 'soundcloud';

export interface AudioState {
  currentSong: Song | null;
  currentEra: Era | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playlist: Song[];
  currentSongIndex: number;
  isShuffle: boolean;
  shuffledQueue: number[];
  loopMode: number;
  hasLoopedOnce: boolean;
  isRandomMode: boolean;
  activePlayer: ActivePlayer;
  // Artwork/artist resolved at play time under the song's own artist config.
  // Kept so the player shows the right values even after navigating into a
  // different artist's tracker (where the active config would resolve wrongly).
  currentArtwork: string;
  currentArtistLabel: string;
}

const initialState: AudioState = {
  currentSong: null,
  currentEra: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playlist: [],
  currentSongIndex: -1,
  isShuffle: false,
  shuffledQueue: [],
  loopMode: 0,
  hasLoopedOnce: false,
  isRandomMode: false,
  activePlayer: 'audio',
  currentArtwork: '',
  currentArtistLabel: '',
};

let state: AudioState = { ...initialState };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getState(): AudioState {
  return state;
}

export function setState(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  emit();
  // Whenever the queue position changes (from App's direct playback path or the
  // store's own), invalidate + rebuild the next-track prefetch so a locked-screen
  // `ended` can advance synchronously. See advancePrefetchedSync / handleEnded.
  if ('currentSongIndex' in patch || 'playlist' in patch || 'isShuffle' in patch || 'shuffledQueue' in patch) {
    schedulePreloadNext();
  }
}

// --- Persistent <audio> element -------------------------------------------

let el: HTMLAudioElement | null = null;
let timeToRestore: number | null = null;

// True once audio has actually started playing at least once this session.
// Used so a newly mounted artist page won't auto-restore its own last track
// over something the user is actively listening to across navigation.
let everPlayed = false;
export function hasEverPlayed(): boolean {
  return everPlayed;
}

function playSafe(a: HTMLAudioElement) {
  const p = a.play();
  if (p !== undefined) {
    p.catch((e) => {
      if (e && e.name !== 'AbortError') console.error('Audio play failed', e);
    });
  }
}

export function getAudioEl(): HTMLAudioElement | null {
  if (el) return el;
  if (typeof Audio === 'undefined') return null;

  el = new Audio();
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  el.setAttribute('playsinline', '');

  el.addEventListener('timeupdate', () => {
    if (el) setState({ currentTime: el.currentTime });
  });
  el.addEventListener('loadedmetadata', () => {
    if (!el) return;
    setState({ duration: el.duration });
    el.volume = state.volume;
    if (timeToRestore !== null) {
      el.currentTime = timeToRestore;
      setState({ currentTime: timeToRestore });
      timeToRestore = null;
    }
  });
  el.addEventListener('play', () => {
    everPlayed = true;
    setState({ isPlaying: true });
  });
  el.addEventListener('pause', () => setState({ isPlaying: false }));
  el.addEventListener('ended', handleEnded);

  // Keep the element in the DOM for the most reliable background playback and
  // media-session behaviour across browsers.
  if (typeof document !== 'undefined' && document.body) {
    el.style.display = 'none';
    document.body.appendChild(el);
  }

  return el;
}

// A stable, ref-like handle so existing `audioRef.current.*` code keeps working.
export const audioRef: { readonly current: HTMLAudioElement | null } = {
  get current() {
    return getAudioEl();
  },
};

// --- One-time defaults ------------------------------------------------------

let volumeInitialized = false;
export function initVolume(value: number) {
  if (volumeInitialized) return;
  volumeInitialized = true;
  const a = getAudioEl();
  if (a) a.volume = value;
  setState({ volume: value });
}

let defaultsInitialized = false;
export function initPlaybackDefaults(isShuffle: boolean, loopMode: number) {
  if (defaultsInitialized) return;
  defaultsInitialized = true;
  setState({ isShuffle, loopMode });
}

export function setTimeToRestore(time: number) {
  timeToRestore = time;
}

// --- Host hooks -------------------------------------------------------------
// When App is mounted it registers its full-featured play handlers so that
// queue advancement reuses the exact same logic (URL resolution, scrobbling,
// preloading, non-audio sources, etc.). When App is not mounted (e.g. on the
// landing page) the store falls back to a lightweight audio-only advance.

type PlaySongFn = (
  song: Song,
  era: Era,
  contextTracks?: Song[],
  resetShuffleHistory?: boolean,
  autoPlay?: boolean,
  isRandomSelection?: boolean,
) => void;

let hostNext: (() => void) | null = null;
let hostPrev: (() => void) | null = null;
let hostPlaySong: PlaySongFn | null = null;

export function registerHost(handlers: {
  next: () => void;
  prev: () => void;
  playSong: PlaySongFn;
}) {
  hostNext = handlers.next;
  hostPrev = handlers.prev;
  hostPlaySong = handlers.playSong;
  return () => {
    if (hostNext === handlers.next) hostNext = null;
    if (hostPrev === handlers.prev) hostPrev = null;
    if (hostPlaySong === handlers.playSong) hostPlaySong = null;
  };
}

// --- Transport override (listening rooms) -----------------------------------
// While the user is in a listening room (src/rooms/*), the room owns the queue:
// next/prev/ended and play/pause (incl. media-session + mini-player buttons) are
// routed to it instead of the local playlist.
export interface TransportOverride {
  onEnded: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPlayPause: (play: boolean) => void;
}
let transportOverride: TransportOverride | null = null;

export function setTransportOverride(o: TransportOverride): () => void {
  transportOverride = o;
  return () => { if (transportOverride === o) transportOverride = null; };
}

// Raw element control for the room sync loop (bypasses the override).
export function rawPlay() {
  const a = getAudioEl();
  if (!a) return;
  a.volume = state.volume;
  playSafe(a);
}

// --- Stream resolution (mirrors App's resolveStreamUrl) --------------------

export async function resolveStreamUrl(rawUrl: string): Promise<string> {
  if (rawUrl.includes('imgur.gg/f/')) {
    const id = rawUrl.split('/f/')[1];
    const host = new URL(rawUrl).host;
    const res = await axios.get(`https://${host}/api/file/${id}`);
    return res.data?.cdnUrl ?? rawUrl;
  } else if (rawUrl.includes('pillows.su/f/') || rawUrl.includes('pillowcase.su/f/')) {
    const id = rawUrl.split('/f/')[1];
    return `https://api.pillows.su/api/get/${id}`;
  } else if (rawUrl.includes('pixeldrain.com/u/')) {
    const id = rawUrl.split('/u/')[1]?.split('?')[0];
    // Pixeldrain blocks Cloudflare egress + hotlinks, so route through the same
    // non-Cloudflare proxy the main App player uses. pixeldrainProxyBase() ships
    // a hard-coded default, so this works even when VITE_PIXELDRAIN_PROXY_URL is
    // unset (previously we fell back to the raw, blocked pixeldrain URL here).
    return `${pixeldrainProxyBase()}/api/${id}`;
  } else if (rawUrl.includes('drive.google.com')) {
    const m = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return `/api/audio-proxy?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${m[1]}`)}`;
  } else if (rawUrl.includes('krakenfiles.com/view/')) {
    return `/api/kraken-proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

export function isDirectlyPlayableAudio(rawUrl: string): boolean {
  if (isChallengeGatedAudioHost(rawUrl)) return false;
  return (
    rawUrl.includes('pillows.su/f/') ||
    rawUrl.includes('pillowcase.su/f/') ||
    rawUrl.includes('imgur.gg/f/') ||
    rawUrl.includes('drive.google.com') ||
    rawUrl.includes('i.imgur.com') ||
    rawUrl.includes('krakenfiles.com/view/') ||
    rawUrl.includes('pixeldrain.com/u/') ||
    rawUrl.startsWith('/') ||
    /\.(mp3|m4a|wav|ogg|flac|aac)(\?|$)/i.test(rawUrl)
  );
}

// --- Transport controls -----------------------------------------------------

export function togglePlay() {
  const a = getAudioEl();
  if (!a) return;
  if (transportOverride) { transportOverride.onPlayPause(a.paused); return; }
  if (a.paused) {
    a.volume = state.volume;
    playSafe(a);
  } else {
    a.pause();
  }
}

export function play() {
  const a = getAudioEl();
  if (!a) return;
  if (transportOverride) { transportOverride.onPlayPause(true); return; }
  a.volume = state.volume;
  playSafe(a);
}

export function pause() {
  if (transportOverride) { transportOverride.onPlayPause(false); return; }
  getAudioEl()?.pause();
}

export function seek(time: number) {
  const a = getAudioEl();
  if (!a) return;
  a.currentTime = time;
  setState({ currentTime: time });
}

function generateShuffledQueue(length: number, firstIndex: number): number[] {
  if (length <= 0) return [];
  const queue = Array.from({ length }, (_, i) => i);
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (firstIndex >= 0 && firstIndex < length) {
    const startIdxPos = queue.indexOf(firstIndex);
    if (startIdxPos > -1) {
      queue.splice(startIdxPos, 1);
      queue.unshift(firstIndex);
    }
  }
  return queue;
}

export function toggleShuffle() {
  const enabling = !state.isShuffle;
  if (enabling && state.playlist.length > 0) {
    setState({ isShuffle: true, shuffledQueue: generateShuffledQueue(state.playlist.length, state.currentSongIndex) });
  } else {
    setState({ isShuffle: enabling });
  }
}

export function cycleLoop() {
  setState({ loopMode: (state.loopMode + 1) % 3 });
}

export function setVolume(v: number) {
  const a = getAudioEl();
  if (a) a.volume = v;
  setState({ volume: v });
}

// Load and play an already-resolved audio stream. App's handlePlaySong calls
// this; the store's own advance path also uses it on routes without App.
export function playAudioStream(opts: {
  song: Song;
  era: Era;
  streamUrl: string;
  playlist: Song[];
  index: number;
  autoPlay?: boolean;
  artwork?: string;
  artistLabel?: string;
}) {
  const autoPlay = opts.autoPlay ?? true;
  const patch: Partial<AudioState> = {
    activePlayer: 'audio',
    currentSong: opts.song,
    currentEra: opts.era,
    playlist: opts.playlist,
    currentSongIndex: opts.index,
    hasLoopedOnce: false,
    isPlaying: autoPlay,
  };
  if (opts.artwork !== undefined) patch.currentArtwork = opts.artwork;
  if (opts.artistLabel !== undefined) patch.currentArtistLabel = opts.artistLabel;
  setState(patch);
  const a = getAudioEl();
  if (a) {
    a.src = opts.streamUrl;
    a.load();
    a.volume = state.volume;
    if (autoPlay) playSafe(a);
  }
  updateMediaSession();
  // The setState above already scheduled a next-track prefetch (queue position
  // changed); no explicit call needed here.
}

// Play an arbitrary list of songs through the global engine, resolving the
// first stream URL. Used by the homepage Playlists page (where the per-artist
// <App> is not mounted) so a globally-mixed playlist plays cross-tracker.
// Each song should carry `.image`/`.artist`/`.realEra` so artwork, the artist
// label, and next/prev advancement resolve without that tracker being loaded.
export async function playSongList(songs: Song[], startIndex: number, era: Era): Promise<void> {
  const song = songs[startIndex];
  if (!song) return;
  const rawUrl = song.url || (song.urls && song.urls[0]) || '';
  if (!rawUrl) return;
  const streamUrl = await resolveStreamUrl(rawUrl);
  if (!streamUrl) return;
  const realEra = (song as any).realEra || era;
  playAudioStream({
    song,
    era: realEra,
    streamUrl,
    playlist: songs,
    index: startIndex,
    autoPlay: true,
    artwork: (song as any).image || song.image || realEra?.image || '',
    artistLabel: (song as any).artist || parseArtistFromSong(song.name, song.extra, realEra?.name),
  });
}

// --- Next-track prefetch (mobile background continuity) ---------------------
// iOS suspends JS when the screen locks; only the <audio> element + media
// session keep running. If advancing on `ended` had to `await` a URL resolve
// before calling play(), iOS blocks it and playback dies on lock. So we resolve
// the upcoming track ahead of time and swap it in synchronously in handleEnded.
let nextResolved: { index: number; url: string } | null = null;
let preloadTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePreloadNext(): void {
  nextResolved = null;
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => { preloadTimer = null; void preloadNext(); }, 400);
}

async function preloadNext(): Promise<void> {
  const idx = computeAdjacentIndex(1);
  if (idx === null) return;
  const song = state.playlist[idx];
  if (!song) return;
  const rawUrl = song.url || (song.urls && song.urls[0]) || '';
  if (!rawUrl || !isDirectlyPlayableAudio(rawUrl)) return;
  try {
    const url = await resolveStreamUrl(rawUrl);
    if (url) nextResolved = { index: idx, url };
  } catch { /* best-effort */ }
}

function metaArtwork(song: Song, era: Era | null): string {
  return state.currentArtwork || (song as any).image || song.image || era?.image || '';
}

function updateMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const song = state.currentSong;
  if (!song) return;
  const era = state.currentEra;
  const eraName = (song as any).realEra?.name || era?.name || '';
  const cover = metaArtwork(song, era);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name.includes(' - ') ? song.name.substring(song.name.indexOf(' - ') + 3) : song.name,
      artist: state.currentArtistLabel || parseArtistFromSong(song.name, song.extra, eraName),
      album: eraName,
      artwork: cover ? [{ src: cover, sizes: '512x512' }, { src: cover, sizes: '256x256' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
  } catch { /* unsupported action */ }
}

function computeAdjacentIndex(direction: 1 | -1): number | null {
  const { playlist, currentSongIndex, isShuffle, shuffledQueue } = state;
  if (playlist.length === 0) return null;

  if (isShuffle && shuffledQueue.length > 0) {
    const idx = shuffledQueue.indexOf(currentSongIndex);
    if (direction === 1) {
      return idx !== -1 && idx < shuffledQueue.length - 1 ? shuffledQueue[idx + 1] : shuffledQueue[0];
    }
    return idx > 0 ? shuffledQueue[idx - 1] : shuffledQueue[shuffledQueue.length - 1];
  }

  let next = currentSongIndex + direction;
  if (next >= playlist.length) next = 0;
  if (next < 0) next = playlist.length - 1;
  return next;
}

// Lightweight audio-only advance used when App is not mounted (landing page,
// etc.). App's own next/prev handle everything else when it is mounted.
function advanceAudioOnly(direction: 1 | -1) {
  const { playlist, currentEra } = state;
  const idx = computeAdjacentIndex(direction);
  if (idx === null || !currentEra) return;
  const song = playlist[idx];
  if (!song) return;
  const era = (song as any).realEra || currentEra;
  const rawUrl = song.url || (song.urls && song.urls[0]) || '';
  if (!rawUrl || !isDirectlyPlayableAudio(rawUrl)) return;
  resolveStreamUrl(rawUrl)
    .then((streamUrl) => {
      if (!streamUrl) return;
      playAudioStream({ song, era, streamUrl, playlist, index: idx, autoPlay: true });
    })
    .catch(() => {});
}

export function playNext() {
  if (transportOverride) { transportOverride.onNext(); return; }
  if (hostNext) {
    hostNext();
    return;
  }
  advanceAudioOnly(1);
}

export function playPrev() {
  if (transportOverride) { transportOverride.onPrev(); return; }
  if (hostPrev) {
    hostPrev();
    return;
  }
  advanceAudioOnly(-1);
}

// Advance to the prefetched next track synchronously (no await), so playback
// continues even when the screen is locked / the tab is backgrounded on mobile.
// Returns false if there's no usable prefetch (caller falls back to playNext).
function advancePrefetchedSync(): boolean {
  const idx = computeAdjacentIndex(1);
  if (idx === null || !nextResolved || nextResolved.index !== idx) return false;
  const song = state.playlist[idx];
  if (!song) return false;
  const era = (song as any).realEra || state.currentEra;
  const a = getAudioEl();
  if (!a) return false;
  a.src = nextResolved.url;
  a.load();
  a.volume = state.volume;
  playSafe(a);
  setState({
    currentSong: song,
    currentEra: era,
    currentSongIndex: idx,
    hasLoopedOnce: false,
    isPlaying: true,
    currentArtwork: (song as any).image || song.image || era?.image || '',
    currentArtistLabel: (song as any).artist || parseArtistFromSong(song.name, song.extra, era?.name),
  });
  updateMediaSession();
  nextResolved = null;
  void preloadNext();
  return true;
}

function handleEnded() {
  if (transportOverride) { transportOverride.onEnded(); return; }
  const { loopMode, hasLoopedOnce } = state;
  const a = getAudioEl();

  if (loopMode === 2) {
    if (a) {
      a.currentTime = 0;
      playSafe(a);
    }
    return;
  }

  if (loopMode === 1) {
    if (!hasLoopedOnce) {
      setState({ hasLoopedOnce: true });
      if (a) {
        a.currentTime = 0;
        playSafe(a);
      }
      return;
    }
    setState({ hasLoopedOnce: false });
  }

  // Prefer the synchronous prefetched advance (survives a locked screen); only
  // fall back to the host/async path when no prefetch is ready.
  if (!advancePrefetchedSync()) playNext();
}

// --- React bindings ---------------------------------------------------------

type Setter<T> = (value: T | ((prev: T) => T)) => void;

// Drop-in replacement for useState, backed by the shared store. Lets App's
// existing `const [x, setX] = useState(...)` sites keep working while making
// the value persist across route/remount boundaries.
export function usePlayerField<K extends keyof AudioState>(key: K): [AudioState[K], Setter<AudioState[K]>] {
  const value = useSyncExternalStore(
    subscribe,
    () => state[key],
    () => state[key],
  );
  const setter = useCallback<Setter<AudioState[K]>>((v) => {
    const next = typeof v === 'function' ? (v as (prev: AudioState[K]) => AudioState[K])(state[key]) : v;
    setState({ [key]: next } as unknown as Partial<AudioState>);
  }, [key]);
  return [value, setter];
}

// Read the whole state reactively (used by the global mini-player).
export function useAudioState(): AudioState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// Lightweight selector: true when the persistent HTML5-audio mini player is
// showing a track. Unlike useAudioState this only re-renders when that fact
// flips, not on every currentTime tick — so pages can reserve bottom space for
// the mini player without re-rendering their whole tree during playback.
export function useHasActiveAudio(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.activePlayer === 'audio' && !!state.currentSong,
    () => false,
  );
}
