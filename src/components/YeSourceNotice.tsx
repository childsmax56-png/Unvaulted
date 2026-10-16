import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

// One-time footer banner on the Ye tracker (yegold) explaining the switch to
// yetracker.net as the primary source, with a shortcut to the old "Suzy"
// tracker (yzygold). Marked as seen as soon as it's shown, so it never
// appears on a later visit even if the user doesn't dismiss it. The tracker
// view remounts once its data loads, so the module-level flags keep it up
// for the rest of this page load instead of vanishing on that remount.
const SEEN_KEY = 'ye_source_notice_seen';
let shownThisLoad = false;
let dismissedThisLoad = false;

function LayersIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function YeSourceNotice({ raised }: { raised: boolean }) {
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean) => { if (!v) dismissedThisLoad = true; setOpenState(v); };

  useEffect(() => {
    if (dismissedThisLoad) return;
    if (!shownThisLoad) {
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
        localStorage.setItem(SEEN_KEY, '1');
      } catch { /* storage blocked — still show it this once */ }
      shownThisLoad = true;
    }
    setOpenState(true);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[640px] z-[60] ${raised ? 'bottom-36 md:bottom-28' : 'bottom-4'}`}
        >
          <div className="relative bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 pr-10 text-sm text-white/75 leading-relaxed">
            <button
              onClick={() => setOpen(false)}
              aria-label="Dismiss"
              className="absolute top-2.5 right-2.5 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
            <p>
              We have switched to <strong className="text-white">yetracker.net</strong> as our primary source for Ye leaks.
              This has caused some changes in eras and song numbers. While yetracker is objectively the better tracker,
              you can click the{' '}
              <span className="inline-flex align-middle items-center justify-center w-5 h-5 rounded-md bg-black/50 text-white/85">
                <LayersIcon />
              </span>{' '}
              button in the top-right corner of Kanye's picture on the home page to switch back to the "Suzy" tracker.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => { window.location.href = '/yzygold'; }}
                className="inline-flex items-center gap-1.5 bg-[var(--theme-color)] text-black text-xs font-bold uppercase tracking-widest px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                <LayersIcon />
                Switch to Suzy tracker
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-bold uppercase tracking-widest px-3.5 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Stay on yetracker
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
