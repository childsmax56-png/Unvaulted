// Subera detection shared by the /api/{slug}/a builder and the tab views.
//
// Tracker sheets break an era into sections with banner rows: the Era cell is
// blank and the Name cell holds the section title, optionally with a dated note
// beside it ("808s & Heartbreak at the Hollywood Bowl" / "(09/25/2015) (Kanye
// performs …)"), or a plain label ("Surfaced Throwaways", "Instrumentals").
// Side tabs use the same blank-Era shape for their era headers, so a banner whose
// title matches the Era of the songs right below it is an era header, not a subera.
// A few sheets instead put the banner in a multi-line Era cell with no Name
// ("BULLY - DELUXE\n(03/28/2026) (BULLY officialy releases)").

export interface Subera {
  name: string;
  note?: string;
}

export type RowKind = 'era-header' | 'subera' | 'song' | 'other';

export interface SuberaOptions {
  eraKey?: string;
  nameKey: string;
  notesKey?: string;
  // Maps a sheet era name to its canonical name, so headers titled with the
  // long name still match song rows that use the short one.
  mapEra?: (era: string) => string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Banner-shaped rows that are sheet chrome, not sections.
const JUNK = /discord|contribute|editors don|inquir|playlist for|re-?up soon|not supposed to see|tracker website|to view only/i;

// "12 OG File(s)\n5 Full\n…" stats cells on era header rows.
const isCountCell = (era: string) =>
  /File\(s\)|Stem Bounce|Total Links/i.test(era) || era.split('\n').some(l => /^\d+\s+\S/.test(l.trim()));

export function classifySuberaRows(rows: Record<string, unknown>[], opts: SuberaOptions): { kinds: RowKind[]; suberas: (Subera | undefined)[] } {
  const eraKey = opts.eraKey ?? 'Era';
  const mapEra = opts.mapEra ?? ((e: string) => e);
  const kinds: RowKind[] = new Array(rows.length).fill('other');
  const suberas: (Subera | undefined)[] = new Array(rows.length).fill(undefined);

  // Era of the next song row at or after i (for header-vs-subera and scoping).
  const nextSongEra: (string | undefined)[] = new Array(rows.length + 1).fill(undefined);
  for (let i = rows.length - 1; i >= 0; i--) {
    const era = str(rows[i][eraKey]).trim();
    const name = str(rows[i][opts.nameKey]).trim();
    nextSongEra[i] = era && !era.includes('\n') && name ? era : nextSongEra[i + 1];
  }

  let current: (Subera & { era: string }) | undefined;

  rows.forEach((row, i) => {
    const era = str(row[eraKey]).trim();
    const name = str(row[opts.nameKey]).trim();
    const note = opts.notesKey ? str(row[opts.notesKey]).trim() : '';

    if (era.includes('\n')) {
      const followingEra = nextSongEra[i + 1];
      if (!name && !isCountCell(era) && followingEra && !JUNK.test(era)) {
        const [title, ...rest] = era.split('\n');
        current = { name: title.trim(), note: rest.join('\n').trim() || undefined, era: followingEra };
        kinds[i] = 'subera';
      } else {
        current = undefined;
        kinds[i] = 'era-header';
      }
      return;
    }

    if (!era) {
      if (!name) return;
      // Real entries with a blank Era still carry a link; banners never do.
      if (Object.values(row).some(v => /https?:\/\//i.test(str(v)))) return;
      const [title, ...extra] = name.split('\n');
      const followingEra = nextSongEra[i + 1];
      if (!followingEra || title.length > 120 || JUNK.test(name)) return;
      const t = norm(title);
      if (t === norm(followingEra) || t === norm(mapEra(followingEra)) || norm(mapEra(title)) === norm(mapEra(followingEra))) {
        current = undefined;
        kinds[i] = 'era-header';
        return;
      }
      current = { name: title.trim(), note: note || extra.join('\n').trim() || undefined, era: followingEra };
      kinds[i] = 'subera';
      return;
    }

    if (!name) return;
    kinds[i] = 'song';
    if (current && current.era !== era) current = undefined;
    if (current) suberas[i] = { name: current.name, note: current.note };
  });

  return { kinds, suberas };
}
