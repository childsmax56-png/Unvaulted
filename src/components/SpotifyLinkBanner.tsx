import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { SiSpotify } from 'react-icons/si';
import { isSpotifyLoggedIn } from '../spotify';
import { applyLinkedServices, fetchLinkedServices, getAccountToken, startSpotifyAccountLink } from '../accountServices';

// Dismissable nudge on the Unreleased tab (era grid + era pages) to link
// Spotify Premium, or — when the account already has Spotify linked but this
// browser doesn't have the tokens — to sync services in one click.
const DISMISS_KEY = 'vg_spotify_banner_dismissed_v1';

function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

type Mode = 'signed-out' | 'link' | 'sync';

export function SpotifyLinkBanner({ className = 'px-6 md:px-8 pt-5' }: { className?: string }) {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [connected, setConnected] = useState(isSpotifyLoggedIn);
  const [mode, setMode] = useState<Mode | null>(() => (getAccountToken() ? null : 'signed-out'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const sync = async () => {
    setBusy(true);
    setMsg('');
    try {
      const linked = await fetchLinkedServices();
      if (!linked) { setMsg('Sync failed — try again from Settings'); return; }
      const { synced, spotifyExpired } = applyLinkedServices(linked);
      if (spotifyExpired) { setMode('link'); setMsg('Spotify session expired — link it again'); return; }
      if (synced.length) window.dispatchEvent(new CustomEvent('vg-synced'));
      setConnected(isSpotifyLoggedIn());
    } catch {
      setMsg('Sync failed — try again from Settings');
    } finally {
      setBusy(false);
    }
  };

  // Work out whether the signed-in account already has Spotify linked.
  useEffect(() => {
    if (dismissed || connected || !getAccountToken()) return;
    let cancelled = false;
    // Returning from the Spotify link flow — pull the new tokens straight in.
    const params = new URLSearchParams(window.location.search);
    if (params.get('vg_spotify_linked') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      setMode('sync');
      sync();
      return;
    }
    fetchLinkedServices()
      .then(linked => { if (!cancelled && linked) setMode(linked.spotify ? 'sync' : 'link'); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dismissed, connected]);

  // Hide once Spotify gets connected from anywhere else (Settings, another tab).
  useEffect(() => {
    const refresh = () => setConnected(isSpotifyLoggedIn());
    window.addEventListener('vg-synced', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('vg-synced', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (dismissed || connected || !mode) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked */ }
  };

  const text = mode === 'sync'
    ? 'Your UNVAULTED account already has Spotify linked. Sync services to use it on this device.'
    : 'Link your Spotify Premium account to make listening easier — play released songs right here.';

  const buttonClass = 'shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg bg-[#1DB954]/15 hover:bg-[#1DB954]/25 text-[#1DB954] transition-colors cursor-pointer disabled:opacity-60';

  return (
    <div className={className}>
      <div className="flex items-center gap-3 p-3 pr-2 rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/[0.06]">
        <SiSpotify className="w-5 h-5 shrink-0 text-[#1DB954]" />
        <p className="flex-1 min-w-0 text-xs sm:text-sm text-white/75">
          {msg || text}
        </p>
        {mode === 'sync' ? (
          <button onClick={sync} disabled={busy} className={buttonClass}>
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Syncing…' : 'Sync services'}
          </button>
        ) : mode === 'link' ? (
          <button onClick={startSpotifyAccountLink} className={buttonClass}>Link Spotify</button>
        ) : (
          <a href="/account" className={buttonClass}>Sign in to link</a>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
