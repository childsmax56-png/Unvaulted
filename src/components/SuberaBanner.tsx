// Section banner for a subera row (see src/suberas.ts), mirroring the grey band
// trackers use to split an era: title, with the dated timeline note underneath.
export function SuberaBanner({ name, note, className = '' }: { name: string; note?: string; className?: string }) {
  return (
    <div className={`bg-white/10 rounded px-3 py-2 mb-2 text-center ${className}`}>
      <div className="text-xs font-bold uppercase tracking-wider text-white/85">{name}</div>
      {note && <div className="mt-0.5 text-[11px] italic text-white/50 whitespace-pre-line">{note}</div>}
    </div>
  );
}
