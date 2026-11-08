import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, RefreshCw, X } from 'lucide-react';
import { SiSpotify } from 'react-icons/si';
import { isSpotifyLoggedIn } from '../spotify';
import { applyLinkedServices, fetchLinkedServices, getAccountToken, startSpotifyAccountLink } from '../accountServices';

// Popup on the Released tab that promotes linking Spotify to the UNVAULTED
// account. If the account already has Spotify linked but this browser isn't
// connected, it offers a one-click "Resync services" instead. "Not now"
// snoozes it for a week; it never shows once Spotify works on this device.
const STATE_KEY = 'vg_spotify_popup_v1';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 1200;

type Mode = 'signed-out' | 'link' | 'sync' | 'done';

function snoozed(): boolean {
  try { return Date.now() < Number(localStorage.getItem(STATE_KEY) || 0); } catch { return false; }
}

function snooze() {
  try { localStorage.setItem(STATE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked */ }
}

export function SpotifyLinkPopup() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const sync = async () => {
    setBusy(true);
    setMsg('');
    try {
      const linked = await fetchLinkedServices();
      if (!linked) { setMsg('Sync failed. Try again, or sync from Settings.'); return; }
      if (!linked.spotify) { setMode('link'); setMsg('Spotify isn\'t linked to your account yet.'); return; }
      const { synced, spotifyExpired } = applyLinkedServices(linked);
      if (spotifyExpired) { setMode('link'); setMsg('Your Spotify session expired. Link it again to keep listening.'); return; }
      if (synced.length) window.dispatchEvent(new CustomEvent('vg-synced'));
      setMode('done');
      setTimeout(() => setOpen(false), 1800);
    } catch {
      setMsg('Sync failed. Try again, or sync from Settings.');
    } finally {
      setBusy(false);
    }
  };

  // Decide which version of the popup (if any) to show.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (m: Mode) => {
      if (cancelled) return;
      setMode(m);
      timer = setTimeout(() => { if (!cancelled) setOpen(true); }, SHOW_DELAY_MS);
    };

    // Returning from the Spotify link flow: pull the new tokens straight in.
    const params = new URLSearchParams(window.location.search);
    if (params.get('vg_spotify_linked') === '1' && getAccountToken()) {
      params.delete('vg_spotify_linked');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      setMode('sync');
      setOpen(true);
      sync();
      return () => { cancelled = true; };
    }

    if (isSpotifyLoggedIn() || snoozed()) return;
    if (!getAccountToken()) { show('signed-out'); return () => { cancelled = true; clearTimeout(timer); }; }
    fetchLinkedServices()
      .then(linked => { if (linked) show(linked.spotify ? 'sync' : 'link'); })
      .catch(() => {});
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Close if Spotify gets connected somewhere else (Settings, another tab).
  useEffect(() => {
    const refresh = () => { if (isSpotifyLoggedIn()) setOpen(o => (o && mode !== 'done' ? false : o)); };
    window.addEventListener('vg-synced', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('vg-synced', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [mode]);

  // Escape closes it like "Not now".
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode]);

  const dismiss = () => {
    if (mode !== 'done') snooze();
    setOpen(false);
  };

  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  const signInHref = `/account.html?next=${encodeURIComponent(next)}`;

  const title = mode === 'sync' ? 'Resync your services'
    : mode === 'done' ? 'Spotify is ready'
    : 'Link Spotify to UNVAULTED';
  const body = mode === 'sync'
    ? 'Your UNVAULTED account already has Spotify linked. Resync to use it on this device and play released songs right here.'
    : mode === 'done'
      ? 'Your services are synced. Released songs will now play through Spotify.'
      : mode === 'signed-out'
        ? 'Sign in to your UNVAULTED account and link Spotify Premium for better listening: play released songs right here, on any device you sign in to.'
        : 'Link your Spotify Premium account for better listening: play released songs right here, on any device you sign in to.';

  const primary = 'inline-flex items-center justify-center gap-2 w-full text-sm font-semibold py-2.5 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default';

  return (
    <AnimatePresence>
      {open && mode && (
        <motion.div
          key="spotify-popup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10040] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-popup-title"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm p-6 rounded-2xl border border-[#1DB954]/20 bg-[#111] shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-center"
          >
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-[#1DB954]/15">
              {mode === 'done'
                ? <Check className="w-7 h-7 text-[#1DB954]" />
                : <SiSpotify className="w-7 h-7 text-[#1DB954]" />}
            </div>
            <h2 id="spotify-popup-title" className="text-lg font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{body}</p>
            {msg && <p className="mt-3 text-xs text-amber-300/90">{msg}</p>}

            {mode !== 'done' && (
              <div className="mt-5 flex flex-col gap-2">
                {mode === 'sync' ? (
                  <button onClick={sync} disabled={busy} className={primary}>
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                    {busy ? 'Syncing…' : 'Resync services'}
                  </button>
                ) : mode === 'link' ? (
                  <button onClick={startSpotifyAccountLink} className={primary}>
                    <SiSpotify className="w-4 h-4" />
                    Link Spotify
                  </button>
                ) : (
                  <a href={signInHref} className={primary}>Sign in to link Spotify</a>
                )}
                <button
                  onClick={dismiss}
                  className="w-full text-sm font-medium py-2 px-4 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Not now
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
