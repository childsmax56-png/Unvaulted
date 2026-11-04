import { Repeat, Repeat1, Infinity as InfinityIcon } from 'lucide-react';

// loopMode: 0 = off, 1 = loop the current song once, 2 = loop it forever.
export const LOOP_LABELS = ['Loop off', 'Loop once', 'Loop forever'];

export function loopTitle(loopMode = 0) {
  return `${LOOP_LABELS[loopMode] ?? LOOP_LABELS[0]} (O)`;
}

export function LoopIcon({ loopMode = 0, className = 'w-4 h-4' }: { loopMode?: number; className?: string }) {
  if (loopMode === 1) return <Repeat1 className={className} />;
  if (loopMode === 2) {
    return (
      <span className="relative inline-flex">
        <Repeat className={className} />
        <InfinityIcon className="absolute -bottom-1.5 -right-2 w-3 h-3 rounded-full bg-[var(--theme-color)] text-black p-[1px]" strokeWidth={3} />
      </span>
    );
  }
  return <Repeat className={className} />;
}
