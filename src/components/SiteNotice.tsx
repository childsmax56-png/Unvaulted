import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X, Mail } from 'lucide-react';

// Bump this id whenever the notice text changes so previously-dismissed
// users see the new one instead of it staying hidden forever. Also gates
// the one-time full-statement modal below.
const NOTICE_ID = 'pillowcase-outage-2026-09-ukraine';

const LINK_STATS: { tab: string; found: number; fixed: number }[] = [
  { tab: 'Unreleased', found: 6182, fixed: 3906 },
  { tab: 'Recent', found: 5464, fixed: 3738 },
  { tab: 'Stems', found: 1506, fixed: 987 },
  { tab: 'Released', found: 394, fixed: 240 },
  { tab: 'Misc', found: 238, fixed: 158 },
  { tab: 'Fakes', found: 145, fixed: 91 },
  { tab: 'Best Of', found: 136, fixed: 99 },
  { tab: 'Album Copies', found: 89, fixed: 39 },
  { tab: 'Art', found: 35, fixed: 23 },
  { tab: 'Tracklists', found: 81, fixed: 22 },
  { tab: 'Groupbuys', found: 55, fixed: 0 },
];
const TOTAL_FOUND = LINK_STATS.reduce((s, r) => s + r.found, 0);
const TOTAL_FIXED = LINK_STATS.reduce((s, r) => s + r.fixed, 0);

const SOCIALS = [
  { label: 'Reddit', href: 'https://www.reddit.com/r/unvaulted/' },
  { label: 'X', href: 'https://x.com/unvaultedcc' },
  { label: 'Instagram', href: 'https://www.instagram.com/unvaulted.cc?stkn=MTF4a242YXZzajMwbw%3D%3D&utm_source=qr' },
  { label: 'Discord', href: 'https://discord.gg/gJy66dvPkD' },
];

export function SiteNotice() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('vg-dismissed-notice') === NOTICE_ID;
    } catch {
      return false;
    }
  });
  const [showStatement, setShowStatement] = useState(() => {
    try {
      return localStorage.getItem('vg-seen-statement') !== NOTICE_ID;
    } catch {
      return false;
    }
  });

  const closeStatement = () => {
    setShowStatement(false);
    try {
      localStorage.setItem('vg-seen-statement', NOTICE_ID);
    } catch {}
  };

  const dismissBanner = () => {
    setDismissed(true);
    try {
      localStorage.setItem('vg-dismissed-notice', NOTICE_ID);
    } catch {}
  };

  return (
    <>
      {!dismissed && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] flex items-start gap-3 bg-amber-950/95 backdrop-blur-sm border-b border-amber-500/30 text-amber-200 px-4 py-2.5 text-sm shadow-lg"
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <p className="flex-1 leading-snug">
            <span className="font-semibold">Service notice:</span> pillowcase.su, the file-hosting service most trackers rely on, is currently down. Many songs may return an "audio unreachable" error while we work around it.{' '}
            <button
              onClick={() => setShowStatement(true)}
              className="underline font-semibold hover:text-amber-100 transition-colors"
            >
              Read the full statement
            </button>
            .
          </p>
          <button
            onClick={dismissBanner}
            className="shrink-0 p-1 rounded-full hover:bg-amber-500/20 transition-colors text-amber-300 hover:text-amber-100"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showStatement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/95 flex items-center justify-center p-4"
            onClick={closeStatement}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-xl max-w-xl w-full p-6 md:p-8 max-h-[85vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-1 tracking-tight font-display">
                A note about pillowcase.su
              </h2>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-6">Service statement</p>

              <div className="space-y-4 mb-6 text-sm text-white/70 leading-relaxed">
                <p>
                  Our thoughts are with everyone affected by the recent attacks on Kyiv, Ukraine, and with those who lost their lives. It's a small thing by comparison, but it's also the reason the site looks a little different right now.
                </p>
                <p>
                  Most trackers on this site rely on pillowcase.su to host files, and pillowcase's servers are based in Ukraine. They were caught up in the recent attacks and are currently offline, meaning songs hosted there will return an "audio unreachable" error. The Pillowcase team has said it could take a few months for their servers to come back online.
                </p>
                <p>
                  As a temporary substitute, we've been re-linking files to Imgur wherever a working copy exists. Huge thanks to{' '}
                  <a href="https://yetracker.cc/" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color,#C9A224)] underline hover:text-[var(--theme-color,#C9A224)]/80">
                    yetracker.cc
                  </a>{' '}
                  for having their entire Kanye West tracker mirrored on imgur.gg — we used it to build{' '}
                  <a href="/yetrackergold/" className="text-[var(--theme-color,#C9A224)] underline hover:text-[var(--theme-color,#C9A224)]/80">
                    an alternate version of the Ye tracker
                  </a>{' '}
                  with working links.
                </p>
                <p className="text-white/50 text-xs uppercase tracking-widest font-semibold pt-1">Link recovery so far</p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10">
                        <th className="text-left font-semibold py-1.5 pr-2">Tab</th>
                        <th className="text-right font-semibold py-1.5 px-2">Dead links</th>
                        <th className="text-right font-semibold py-1.5 pl-2">Fixed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LINK_STATS.map(row => (
                        <tr key={row.tab} className="border-b border-white/5">
                          <td className="py-1.5 pr-2 text-white/70">{row.tab}</td>
                          <td className="py-1.5 px-2 text-right text-white/50">{row.found.toLocaleString()}</td>
                          <td className="py-1.5 pl-2 text-right text-white/70">{row.fixed.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="text-white font-semibold">
                        <td className="py-1.5 pr-2">Total</td>
                        <td className="py-1.5 px-2 text-right">{TOTAL_FOUND.toLocaleString()}</td>
                        <td className="py-1.5 pl-2 text-right">{TOTAL_FIXED.toLocaleString()} ({Math.round((TOTAL_FIXED / TOTAL_FOUND) * 100)}%)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  If you happen to have a full local download of any other artist's tracker, please reach out — it would help us do the same for other artists.
                </p>
                <p className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-white/40 shrink-0" />
                  <a href="mailto:unvaultedcc@gmail.com" className="text-[var(--theme-color,#C9A224)] underline hover:text-[var(--theme-color,#C9A224)]/80">
                    unvaultedcc@gmail.com
                  </a>
                </p>
                <p className="flex flex-wrap gap-x-2 gap-y-1 text-white/50">
                  {SOCIALS.map((s, i) => (
                    <span key={s.label}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-[var(--theme-color,#C9A224)] underline hover:text-[var(--theme-color,#C9A224)]/80">
                        {s.label}
                      </a>
                      {i < SOCIALS.length - 1 && <span className="text-white/20">{' · '}</span>}
                    </span>
                  ))}
                </p>
              </div>

              <button
                onClick={closeStatement}
                className="w-full bg-[var(--theme-color,#C9A224)] text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-[var(--theme-color,#C9A224)]/90 transition-colors"
              >
                I Understand
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
