import { AVAILABILITY_META, AVAILABILITY_ORDER, type AvailabilityCounts } from '../availability';

export function availabilitySummary(c: AvailabilityCounts): string {
  return `${c.full} full, ${c.partial} partial, ${c.snippet} snippets, ${c.none} not leaked`;
}

// Stacked bar: full → partial → snippet, with the track itself standing in for
// "not leaked" so an era that's mostly lost reads as mostly empty.
export function AvailabilityBar({ counts, className = '', height = 6 }: { counts: AvailabilityCounts; className?: string; height?: number }) {
  const total = counts.total || 1;
  return (
    <div
      role="img"
      aria-label={availabilitySummary(counts)}
      className={`flex w-full overflow-hidden rounded-full ${className}`}
      style={{ height, background: AVAILABILITY_META.none.color }}
    >
      {AVAILABILITY_ORDER.filter(k => k !== 'none').map(k => (
        <span key={k} style={{ width: `${(100 * counts[k]) / total}%`, background: AVAILABILITY_META[k].color }} />
      ))}
    </div>
  );
}

export function AvailabilityLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60 ${className}`}>
      {AVAILABILITY_ORDER.map(k => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: AVAILABILITY_META[k].color }} />
          {AVAILABILITY_META[k].label}
        </span>
      ))}
    </div>
  );
}
