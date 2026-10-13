import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { ArtistConfig } from '../artists/types';
import { getArtistConfig } from '../artists/registry';

// Small picker button overlaid on a homepage artist card (EditorialArtistCard
// in LandingPage.tsx) for artists tracked by more than one sheet/tracker.
// Lists `config.alternateTrackers` and navigates to whichever one is picked.
//
// The dropdown is portaled to document.body (positioned via getBoundingClientRect,
// same approach as FilterMenu.tsx's tag tooltips) because the card it lives inside
// has `overflow: hidden` — a plain absolutely-positioned child would get clipped.
export function AlternateTrackerButton({ config }: { config: ArtistConfig }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  const alternates = config.alternateTrackers ?? [];
  if (!alternates.length) return null;

  // Resolve each alt's own branding (card letter, accent) for a small badge —
  // falls back to the label's initials if a slug isn't in the static registry.
  const resolved = alternates.map(alt => ({ ...alt, target: getArtistConfig(alt.slug) }));

  const PANEL_WIDTH = 208;
  const CARET_OFFSET = 15; // distance from the panel's right edge to the caret's center
  const left = rect
    ? Math.min(Math.max(rect.right - PANEL_WIDTH, 8), window.innerWidth - PANEL_WIDTH - 8)
    : 0;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="View alternate trackers"
        title="Alternate trackers"
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 2,
          width: 24, height: 24, borderRadius: 7, border: 'none', cursor: 'pointer',
          background: open ? '#C9A224' : hover ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)',
          boxShadow: open ? '0 2px 10px rgba(201,162,36,0.4)' : '0 1px 3px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
          transform: hover && !open ? 'scale(1.06)' : 'scale(1)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={open ? '#121212' : 'rgba(255,255,255,0.85)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed', top: rect.bottom + 10, left,
                zIndex: 9999, width: PANEL_WIDTH,
                transformOrigin: `${PANEL_WIDTH - CARET_OFFSET}px top`,
              }}
            >
              {/* caret pointing back up at the trigger button */}
              <div
                style={{
                  position: 'absolute', top: -5, right: CARET_OFFSET - 5,
                  width: 10, height: 10, background: '#171717',
                  borderLeft: '1px solid rgba(255,255,255,0.12)',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  transform: 'rotate(45deg)',
                }}
              />
              <div className="bg-[#171717] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="px-3.5 pt-3 pb-2 flex items-center gap-1.5 border-b border-white/[0.06]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C9A224" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                  </svg>
                  <span className="text-[10px] uppercase tracking-widest text-white/45 font-bold">
                    Switch Tracker
                  </span>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  {resolved.map(alt => {
                    const accent = alt.target?.accentColor ?? '#C9A224';
                    const initials = (alt.target?.cardLetter ?? alt.label.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).toUpperCase();
                    return (
                      <button
                        key={alt.slug}
                        onClick={(e) => { e.stopPropagation(); setOpen(false); navigate(`/${alt.slug}`); }}
                        className="w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg text-sm font-semibold text-white/85 hover:text-white hover:bg-white/[0.07] active:bg-white/[0.12] transition-colors group"
                      >
                        <span
                          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-extrabold tracking-tight"
                          style={{ background: `${accent}22`, color: accent }}
                        >
                          {initials}
                        </span>
                        <span className="flex-1 truncate">{alt.label}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/25 group-hover:text-white/60 transition-colors group-hover:translate-x-0.5" style={{ transition: 'transform 0.15s, color 0.15s' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
