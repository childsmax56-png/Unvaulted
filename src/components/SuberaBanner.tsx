// Section banner for a subera row (see src/suberas.ts), mirroring the grey band
// trackers use to split an era: title, with the dated timeline note underneath.
// `data-subera-anchor` is what SuberaJumpBar scrolls to.
export function SuberaBanner({ name, note, className = '' }: { name: string; note?: string; className?: string }) {
  return (
    <div data-subera-anchor={name} className={`bg-white/10 rounded px-3 py-2 mb-2 text-center scroll-mt-24 ${className}`}>
      <div className="text-xs font-bold uppercase tracking-wider text-white/85">{name}</div>
      {note && <div className="mt-0.5 text-[11px] italic text-white/50 whitespace-pre-line">{note}</div>}
    </div>
  );
}

// Unique subera names in display order, for SuberaJumpBar.
export function uniqueSuberas(items: { subera?: string }[]): string[] {
  return [...new Set(items.map(i => i.subera).filter((s): s is string => !!s))];
}

// Chips at the top of an era that scroll to each subera banner. Hidden when the
// era has fewer than two suberas, since there's nothing to skip between.
export function SuberaJumpBar({ names, className = '' }: { names: string[]; className?: string }) {
  if (names.length < 2) return null;
  const jump = (name: string) =>
    document.querySelector(`[data-subera-anchor="${CSS.escape(name)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className={`flex flex-wrap items-center gap-2 mb-6 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mr-1">Jump to</span>
      {names.map(name => (
        <button
          key={name}
          onClick={() => jump(name)}
          className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/75 hover:bg-white/10 hover:text-white transition-colors"
        >
          {name}
        </button>
      ))}
    </div>
  );
}
