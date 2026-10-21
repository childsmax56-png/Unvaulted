import { useRef, useState } from 'react';

// Draggable progress bar that works with mouse, touch and pen (pointer events).
// While dragging, the fill and the time label follow the finger and the actual
// seek happens on release — seeking on every move stutters streamed audio on
// mobile. The hit area is taller than the visible track so it's easy to grab.
export function SeekBar({ currentTime, duration, onSeek, onScrub, className = '' }: {
  currentTime: number,
  duration: number,
  onSeek?: (time: number) => void,
  // Reports the in-progress drag position (or null when the drag ends) so the
  // caller can show it in its elapsed-time label.
  onScrub?: (time: number | null) => void,
  className?: string,
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const enabled = !!onSeek && duration > 0;

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };
  const update = (t: number | null) => { setScrub(t); onScrub?.(t); };

  const shown = scrub ?? currentTime;
  const pct = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0;
  const dragging = scrub !== null;

  return (
    <div
      className={`flex-1 py-2.5 -my-2.5 touch-none select-none group ${enabled ? 'cursor-pointer' : ''} ${className}`}
      onPointerDown={(e) => {
        if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
        update(timeAt(e.clientX));
      }}
      onPointerMove={(e) => { if (dragging) update(timeAt(e.clientX)); }}
      onPointerUp={(e) => {
        if (!dragging) return;
        onSeek?.(timeAt(e.clientX));
        update(null);
      }}
      onPointerCancel={() => update(null)}
    >
      <div ref={trackRef} className={`relative bg-white/10 rounded-full transition-[height] ${dragging ? 'h-2' : 'h-1.5'}`}>
        <div
          className={`absolute top-0 left-0 h-full bg-white rounded-full ${dragging ? '' : 'transition-all duration-100 ease-linear'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className={`absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity ${dragging ? 'opacity-100 scale-110' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
