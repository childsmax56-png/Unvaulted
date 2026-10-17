import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, StickyNote, X } from 'lucide-react';
import { formatTextWithTags, parseNoteDescription } from '../utils';

// A reusable "read the full note" affordance. Row notes are clamped/truncated to
// one or two lines in every list view; this opens a dismissable popup with the
// whole thing (plus any OG filename). Renders nothing when there's no note.
//   `note` is the raw notes/description cell — OG Filename lines are split out.
interface Props {
  note: string | undefined | null;
  title: string;
  isCurrentlyPlaying?: boolean;
  className?: string;
}

export function NoteButton({ note, title, isCurrentlyPlaying, className }: Props) {
  const [open, setOpen] = useState(false);
  if (!note || !note.trim()) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => e.stopPropagation()}
        title="View full note"
        aria-label="View full note"
        className={`p-1 rounded transition-all hover:bg-white/10 cursor-pointer shrink-0 ${
          isCurrentlyPlaying ? 'text-[var(--theme-color)]/60 hover:text-[var(--theme-color)]' : 'text-white/20 hover:text-white/70'
        } ${className || ''}`}
      >
        <StickyNote className="w-3.5 h-3.5" />
      </button>
      <NoteModal isOpen={open} onClose={() => setOpen(false)} note={note} title={title} />
    </>
  );
}

export function NoteModal({ isOpen, onClose, note, title }: { isOpen: boolean; onClose: () => void; note: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const { ogFilename, note: body } = parseNoteDescription(note);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => { if (!isOpen) setCopied(false); }, [isOpen]);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="fixed inset-0 z-[100010] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[520px] max-h-[85vh] sm:max-h-[70vh] bg-[#1a1a1a] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <StickyNote className="w-4 h-4 text-[var(--theme-color)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm">Notes</div>
                  <div className="text-[11px] text-white/40 truncate">{title}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={copy}
                  title="Copy note"
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button onClick={onClose} title="Close" className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 select-text">
              {body && (
                <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
                  {formatTextWithTags(body)}
                </div>
              )}
              {ogFilename && (
                <div className="text-xs font-mono text-white/40 break-all">
                  <span className="text-white/25 uppercase tracking-wider text-[10px] font-sans font-bold mr-2">OG Filename</span>
                  {ogFilename}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
