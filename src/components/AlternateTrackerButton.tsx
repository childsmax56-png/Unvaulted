import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { ArtistConfig } from '../artists/types';

// Small picker button overlaid on a homepage artist card (EditorialArtistCard
// in LandingPage.tsx) for artists tracked by more than one sheet/tracker.
// Lists `config.alternateTrackers` and navigates to whichever one is picked.
//
// The dropdown is portaled to document.body (positioned via getBoundingClientRect,
// same approach as FilterMenu.tsx's tag tooltips) because the card it lives inside
// has `overflow: hidden` — a plain absolutely-positioned child would get clipped.
export function AlternateTrackerButton({ config }: { config: ArtistConfig }) {
  const [open, setOpen] = useState(false);
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

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        aria-label="View alternate trackers"
        title="Alternate trackers"
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 2,
          width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
          background: open ? 'rgba(201,162,36,0.25)' : 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={open ? '#C9A224' : 'rgba(255,255,255,0.75)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed', top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 150),
                zIndex: 9999, minWidth: 140,
              }}
              className="bg-[#111] border border-white/10 rounded-lg overflow-hidden shadow-xl"
            >
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/40 font-semibold border-b border-white/10">
                Alt Trackers
              </div>
              {alternates.map(alt => (
                <button
                  key={alt.slug}
                  onClick={(e) => { e.stopPropagation(); setOpen(false); navigate(`/${alt.slug}`); }}
                  className="w-full text-left px-3 py-2 text-sm font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {alt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
