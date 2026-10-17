import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useCommentCount } from '../comments';
import { CommentsModal } from './CommentsModal';

// A reusable "comment on this entry" affordance. Drop it into any row/card in
// any view — song, stem, art, video, fake, misc, released, or a whole era. It
// shows a speech bubble with a live comment count and opens the shared thread
// modal.
//   variant 'icon' (default): compact icon for row/card action clusters.
//   variant 'pill': h-10 rounded pill matching era-header buttons (Share etc.),
//     with a "Comments" label.
interface Props {
  tracker: string;
  entryKey: string;
  entryLabel: string;
  entryType?: string;
  isCurrentlyPlaying?: boolean;
  variant?: 'icon' | 'pill';
  className?: string;
}

export function CommentButton({ tracker, entryKey, entryLabel, entryType, isCurrentlyPlaying, variant = 'icon', className }: Props) {
  const [open, setOpen] = useState(false);
  const count = useCommentCount(tracker, entryKey);
  const hasCount = !!count && count > 0;

  return (
    <>
      {variant === 'pill' ? (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          title="Comments"
          className={`w-auto px-4 h-10 flex items-center justify-center gap-2 rounded-full transition-colors cursor-pointer ${
            hasCount ? 'bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
          } ${className || ''}`}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
            {hasCount ? `${count > 99 ? '99+' : count} Comment${count === 1 ? '' : 's'}` : 'Comment'}
          </span>
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          title="Comments"
          className={`relative p-1 rounded transition-all hover:bg-white/10 cursor-pointer flex items-center gap-1 ${
            hasCount ? 'text-white/70 hover:text-white' : isCurrentlyPlaying ? 'text-[var(--theme-color)]/60 hover:text-[var(--theme-color)]' : 'text-white/20 hover:text-white/70'
          } ${className || ''}`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {hasCount && (
            <span className="text-[10px] font-semibold leading-none">{count > 99 ? '99+' : count}</span>
          )}
        </button>
      )}
      <CommentsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        tracker={tracker}
        entryKey={entryKey}
        entryLabel={entryLabel}
        entryType={entryType}
      />
    </>
  );
}
