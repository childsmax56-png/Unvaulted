import { useState } from 'react';
import { X } from 'lucide-react';
import { classifySuberaRows, RowKind } from '../suberas';

// Auto-detected tag filters for the side tabs (Art, Misc, Stems, Fakes, Released,
// Videos). Each tracker's sheets carry their own categorical columns — Art "Use"
// (Used / Unused / Alternate) and "Art Type", Misc "Type" / "Available Length",
// Released "Streaming" (Yes / No) — so instead of hardcoding them per artist, any
// short, repeating column is offered as a filter group. Values within a group are
// OR'd, groups are AND'd.

export interface TagColumn {
  key: string;
  label: string;
  values: { value: string; count: number }[];
}

export type TagSelection = Record<string, string[]>;

type Row = Record<string, unknown>;

// Columns that are never tags even when their values happen to repeat.
const SKIP_KEY = /^(era|name|notes?\b.*|info|image.*|links?|link\(s\)|subera.*|bpm|featureextra|made by|designers?|credits?|producers?)$/i;
const TIME = /^\d{1,2}:\d{2}(:\d{2})?$/;
const MAX_VALUE_LEN = 40;
const MAX_VALUES = 30;

const cell = (row: Row, key: string): string => {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : '';
};

const rowKinds = (rows: Row[]): RowKind[] =>
  rows.length > 0 && 'Name' in rows[0] ? classifySuberaRows(rows, { nameKey: 'Name' }).kinds : rows.map(() => 'song' as RowKind);

export function detectTagColumns(rows: Row[]): TagColumn[] {
  if (rows.length === 0) return [];
  const kinds = rowKinds(rows);
  const songs = rows.filter((_, i) => kinds[i] === 'song');
  if (songs.length < 4) return [];

  const keys: string[] = [];
  for (const r of songs.slice(0, 50)) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);

  const columns: TagColumn[] = [];
  for (const key of keys) {
    const label = key.replace(/\s+/g, ' ').trim();
    if (!label || SKIP_KEY.test(label) || /date/i.test(label)) continue;

    const counts = new Map<string, number>();
    let filled = 0;
    let timeLike = 0;
    for (const r of songs) {
      const v = cell(r, key);
      if (!v) continue;
      filled++;
      if (TIME.test(v)) timeLike++;
      if (v.includes('\n') || v.length > MAX_VALUE_LEN) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    if (filled === 0 || timeLike > filled / 2) continue;

    // One-off values are usually sheet chrome ("Shoutout to …") or free text.
    const values = [...counts.entries()].filter(([, c]) => c >= 2).map(([value, count]) => ({ value, count }));
    const covered = values.reduce((n, v) => n + v.count, 0);
    if (values.length < 2 || values.length > MAX_VALUES || covered < songs.length * 0.2) continue;

    values.sort((a, b) => b.count - a.count);
    // App.tsx renames Released "Streaming" to "Quality" for the row badge.
    const yesNo = values.every(v => /^(yes|no)$/i.test(v.value));
    columns.push({ key, label: yesNo && label === 'Quality' ? 'Streaming' : label, values });
  }
  return columns;
}

export function hasTagSelection(sel: TagSelection): boolean {
  return Object.values(sel).some(v => v.length > 0);
}

// Filters song rows only; era headers and subera banners pass through so the
// views still group and label whatever songs survive.
export function applyTagFilter<T>(rows: T[], sel: TagSelection): T[] {
  const active = Object.entries(sel).filter(([, v]) => v.length > 0);
  if (active.length === 0) return rows;
  const kinds = rowKinds(rows as unknown as Row[]);
  return rows.filter((row, i) =>
    kinds[i] !== 'song' || active.every(([key, values]) => values.includes(cell(row as unknown as Row, key))));
}

const COLLAPSED_COUNT = 8;

export function TagFilterBar({ columns, selection, onChange }: { columns: TagColumn[]; selection: TagSelection; onChange: (sel: TagSelection) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (columns.length === 0) return null;

  const toggle = (key: string, value: string) => {
    const cur = selection[key] || [];
    onChange({ ...selection, [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] });
  };

  return (
    <div className="px-6 md:px-8 pt-5 -mb-2 flex flex-col gap-2">
      {columns.map(col => {
        const selected = selection[col.key] || [];
        const showAll = expanded[col.key] || col.values.length <= COLLAPSED_COUNT;
        // Keep selected chips visible even when the group is collapsed.
        const visible = showAll ? col.values : col.values.filter((v, i) => i < COLLAPSED_COUNT || selected.includes(v.value));
        const hidden = col.values.length - visible.length;
        return (
          <div key={col.key} className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible">
            <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-white/40 mr-1">{col.label}</span>
            {visible.map(({ value, count }) => {
              const on = selected.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => toggle(col.key, value)}
                  className={`shrink-0 whitespace-nowrap text-xs px-2.5 py-1 rounded-full border transition-colors ${on
                    ? 'bg-white text-black border-white'
                    : 'border-white/10 text-white/70 bg-white/5 hover:bg-white/10 hover:text-white'}`}
                >
                  {value}
                  <span className={`ml-1.5 ${on ? 'text-black/50' : 'text-white/30'}`}>{count}</span>
                </button>
              );
            })}
            {hidden > 0 && (
              <button onClick={() => setExpanded(e => ({ ...e, [col.key]: true }))} className="shrink-0 whitespace-nowrap text-xs px-2 py-1 text-white/40 hover:text-white">
                +{hidden} more
              </button>
            )}
            {showAll && col.values.length > COLLAPSED_COUNT && (
              <button onClick={() => setExpanded(e => ({ ...e, [col.key]: false }))} className="text-xs px-2 py-1 text-white/40 hover:text-white">
                less
              </button>
            )}
          </div>
        );
      })}
      {hasTagSelection(selection) && (
        <button onClick={() => onChange({})} className="self-start text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors">
          <X className="w-3 h-3" /> Clear tag filters
        </button>
      )}
    </div>
  );
}
