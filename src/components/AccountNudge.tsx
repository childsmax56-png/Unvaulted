import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Cloud, X } from 'lucide-react';
import { getAccountToken } from '../accountServices';
import { GLOBAL_PLAYLISTS_KEY } from '../globalPlaylistSync';

// A small, dismissable card that suggests making an account. It only appears
// right after a signed-out user saves something worth keeping (their 5th
// favorite or first playlist), never on page load. "Not now" snoozes it for two
// weeks, and a second dismissal turns it off for good.
const STATE_KEY = 'vg_account_nudge_v1';
const FAVORITES_THRESHOLD = 5;
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 2;

interface NudgeState { dismissals: number; snoozedUntil: number }

function readState(): NudgeState {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (s && typeof s.dismissals === 'number') return s;
  } catch { /* storage blocked or corrupt */ }
  return { dismissals: 0, snoozedUntil: 0 };
}

function writeState(s: NudgeState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

// Favorites live per tracker (`<prefix>favorite_keys`), so count all of them.
function countSaved(): { favorites: number; playlists: number } {
  let favorites = 0;
  let playlists = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.endsWith('favorite_keys')) continue;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(list)) favorites += list.length;
    }
    const pls = JSON.parse(localStorage.getItem(GLOBAL_PLAYLISTS_KEY) || '[]');
    if (Array.isArray(pls)) playlists = pls.filter((p: { readonly?: boolean }) => !p?.readonly).length;
  } catch { /* storage blocked or corrupt */ }
  return { favorites, playlists };
}

function eligible(): boolean {
  if (getAccountToken()) return false;
  const s = readState();
  return s.dismissals < MAX_DISMISSALS && Date.now() >= s.snoozedUntil;
}

export function AccountNudge() {
  const [saved, setSaved] = useState<{ favorites: number; playlists: number } | null>(null);

  useEffect(() => {
    const onSave = () => {
      if (!eligible()) return;
      const counts = countSaved();
      if (counts.favorites >= FAVORITES_THRESHOLD || counts.playlists >= 1) setSaved(counts);
    };
    // Hide if the user signs in from another tab.
    const onStorage = (e: StorageEvent) => { if (e.key === 'vg_token' && e.newValue) setSaved(null); };
    window.addEventListener('vg-favorites-changed', onSave);
    window.addEventListener('vg-playlists-changed', onSave);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('vg-favorites-changed', onSave);
      window.removeEventListener('vg-playlists-changed', onSave);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const dismiss = () => {
    const s = readState();
    writeState({ dismissals: s.dismissals + 1, snoozedUntil: Date.now() + SNOOZE_MS });
    setSaved(null);
  };

  const what = saved
    ? [
        saved.favorites > 0 && `${saved.favorites} favorite${saved.favorites === 1 ? '' : 's'}`,
        saved.playlists > 0 && `${saved.playlists} playlist${saved.playlists === 1 ? '' : 's'}`,
      ].filter(Boolean).join(' and ')
    : '';
  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  const href = `/account.html?tab=register&next=${encodeURIComponent(next)}`;

  return (
    <AnimatePresence>
      {saved && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-[340px] z-[10050] p-4 pr-3 rounded-2xl border border-white/10 bg-[#111]/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--theme-color)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Keep your {what}</p>
              <p className="mt-1 text-xs text-white/55 leading-relaxed">
                Right now they're only saved in this browser. A free account backs them up and syncs them to your other devices.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={href}
                  className="text-xs font-semibold py-1.5 px-3 rounded-lg text-black transition-opacity hover:opacity-90"
                  style={{ background: 'var(--theme-color)' }}
                >
                  Create free account
                </a>
                <button
                  onClick={dismiss}
                  className="text-xs font-medium py-1.5 px-3 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 p-1 rounded-md text-white/35 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
