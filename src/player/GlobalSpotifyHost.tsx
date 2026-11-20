// Connects a Spotify Web Playback device on routes where the per-artist <App>
// isn't mounted (Playlists, landing page, …) and plugs it into the shared
// audioStore, so Spotify links in playlists play full tracks in the page, in
// the same queue and mini player as everything else. Needs Spotify Premium
// linked on this device; without it nothing registers and Spotify rows fall
// back to the embedded Spotify player.
import { useEffect, useRef, useState } from 'react';
import { isSpotifyLoggedIn } from '../spotify';
import { useSpotify } from '../useSpotify';
import * as audioStore from './audioStore';

export function GlobalSpotifyHost() {
  const [enabled, setEnabled] = useState(isSpotifyLoggedIn());
  const { state, controls } = useSpotify(enabled);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  // Pick up a Spotify login/sync that happens while this route is open.
  useEffect(() => {
    const refresh = () => setEnabled(isSpotifyLoggedIn());
    window.addEventListener('vg-synced', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('vg-synced', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Register with the store once the device is ready (and no account error,
  // e.g. not Premium).
  useEffect(() => {
    if (!state.isReady || state.error) return;
    return audioStore.setSpotifyHost({
      play: (uri) => controlsRef.current.playUri(uri),
      pause: () => { void controlsRef.current.pause(); },
      resume: () => { void controlsRef.current.togglePlay(); },
      seek: (sec) => { void controlsRef.current.seek(sec * 1000); },
      setVolume: (v) => { void controlsRef.current.setVolume(v); },
    });
  }, [state.isReady, state.error]);

  // Mirror Spotify's playback into the store and detect the end of a track
  // (the SDK reports it as: paused, position back at 0, after playing near
  // the end).
  const lastRef = useRef({ playing: false, position: 0, duration: 0, id: '' });
  useEffect(() => {
    const s = audioStore.getState();
    if (s.activePlayer !== 'spotify') { lastRef.current.playing = false; return; }
    const track = state.currentTrack;
    const duration = track ? track.duration / 1000 : s.duration;
    const position = state.position / 1000;
    const last = lastRef.current;
    const ended = last.playing && !state.isPlaying && state.position === 0
      && track?.id === last.id && last.duration > 0 && last.position > last.duration - 3;
    lastRef.current = { playing: state.isPlaying, position, duration, id: track?.id || '' };
    if (ended) { audioStore.spotifyTrackEnded(); return; }
    audioStore.setState({
      isPlaying: state.isPlaying,
      currentTime: Math.min(position, duration || position),
      ...(duration ? { duration } : {}),
    });
  }, [state.isPlaying, state.position, state.currentTrack]);

  return null;
}
