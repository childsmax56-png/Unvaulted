import { parseCSV, csvResponse } from './_csvParser';
import { fetchTrackerCsv } from './_sheets';
import { classifySuberaRows, type Subera } from '../../../src/suberas';

// Split a "Name\n(subtitle)" cell into its display name and optional extra line.
function firstLine(raw: string): { name: string; extra?: string } {
  const nl = raw.indexOf('\n');
  if (nl === -1) return { name: raw.trim() };
  const name = raw.substring(0, nl).trim();
  const extra = raw.substring(nl).trim().replace(/^\n+/, '') || undefined;
  return { name, extra };
}

// Some sheets put a file-count summary ("0 Full / 0 Tagged / ...") in the Era cell
// on header rows. Those are separators, not real eras.
const FILE_COUNT_RE = /\b(Full|Tagged|Partial|Snippet|Unavailable)\b/i;
function isFileCountEra(era: string): boolean {
  return era.includes('\n') && FILE_COUNT_RE.test(era);
}

interface Copy {
  name: string;
  extra?: string;
  notes: string;
  copy_length: string;
  date: string;
  available_length: string;
  type: string;
  quality: string;
  url: string;
  urls: string[];
  subera?: string;
  subera_note?: string;
}

interface EraGroup {
  name: string;
  extra?: string;
  copies: Copy[];
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const artist = (context.params as Record<string, string>).artist ?? 'yzygold';

    let text = await fetchTrackerCsv(url.origin, artist, 'album-copies');
    if (text === null) return csvResponse({ eras: [] });

    // Strip any disclaimer/preamble lines before the real "Era," header row.
    const lines = text.split('\n');
    const headerIdx = lines.findIndex(
      (l) => l.trimStart().startsWith('Era,') || l.trimStart().startsWith('"Era"'),
    );
    if (headerIdx > 0) text = lines.slice(headerIdx).join('\n');

    const rows = parseCSV(text);
    if (rows.length === 0) return csvResponse({ eras: [] });

    // Flexible column detection — the various trackers use different headers.
    const keys = Object.keys(rows[0]);
    const NAME_KEY =
      keys.find((k) => k.startsWith('Name')) ?? keys.find((k) => k.startsWith('Title')) ?? 'Name';
    const NOTES_KEY =
      keys.find((k) => k.startsWith('Notes')) ?? keys.find((k) => k === 'Info') ?? 'Notes';
    const LENGTH_KEY =
      keys.find((k) => k.startsWith('Copy')) ?? keys.find((k) => k === 'Length') ?? '';
    const DATE_KEY =
      keys.find((k) => k.startsWith('File')) ??
      keys.find((k) => k === 'Release Date') ??
      keys.find((k) => k === 'Date') ??
      '';
    const AVAIL_KEY =
      keys.find((k) => k.startsWith('Available')) ??
      keys.find((k) => k === 'Availability') ??
      keys.find((k) => k === 'Portion') ??
      '';
    const TYPE_KEY = keys.find((k) => k === 'Type') ?? '';
    const QUALITY_KEY = keys.find((k) => k === 'Quality') ?? 'Quality';
    const LINK_KEY =
      keys.find((k) => k === 'Link(s)') ??
      keys.find((k) => k === 'Link') ??
      keys.find((k) => k.startsWith('Link')) ??
      'Link(s)';

    // Two layouts exist: some sheets have dedicated era-header rows (empty Era cell,
    // era name in the Name column); others list the era name directly on every row.
    const hasHeaderRows = rows.some(
      (r) => (r['Era'] ?? '').trim() === '' && firstLine(r[NAME_KEY] ?? '').name !== '',
    );

    const eras: EraGroup[] = [];
    const eraByName: Record<string, EraGroup> = {};
    const getEra = (name: string, extra?: string): EraGroup => {
      if (!eraByName[name]) {
        const era: EraGroup = { name, extra: extra || undefined, copies: [] };
        eraByName[name] = era;
        eras.push(era);
      } else if (extra && !eraByName[name].extra) {
        eraByName[name].extra = extra;
      }
      return eraByName[name];
    };

    // Subera banners share the header rows' blank-Era shape; tell them apart so a
    // banner doesn't start a new era (see src/suberas.ts).
    const { kinds, suberas } = classifySuberaRows(rows, { nameKey: NAME_KEY, notesKey: NOTES_KEY });

    const addCopy = (era: EraGroup, row: Record<string, string>, name: string, extra?: string, subera?: Subera) => {
      const links = (row[LINK_KEY] ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      era.copies.push({
        name,
        extra,
        notes: (row[NOTES_KEY] ?? '').trim(),
        copy_length: LENGTH_KEY ? (row[LENGTH_KEY] ?? '').trim() : '',
        date: DATE_KEY ? (row[DATE_KEY] ?? '').trim() : '',
        available_length: AVAIL_KEY ? (row[AVAIL_KEY] ?? '').trim() : '',
        type: TYPE_KEY ? (row[TYPE_KEY] ?? '').trim() : '',
        quality: (row[QUALITY_KEY] ?? '').trim(),
        url: links[0] ?? '',
        urls: links,
        subera: subera?.name,
        subera_note: subera?.note,
      });
    };

    let currentEra: EraGroup | null = null;

    for (const [rowIdx, row] of rows.entries()) {
      const eraField = (row['Era'] ?? '').trim();
      const { name, extra } = firstLine(row[NAME_KEY] ?? '');
      if (kinds[rowIdx] === 'subera') continue;

      if (hasHeaderRows) {
        if (eraField === '' && name) {
          // Era header row — its Name column holds the era's display name.
          currentEra = getEra(name, extra);
          continue;
        }
        // Copy row — attach to the most recent era header. The row's own Era value
        // is sometimes a typo variant of the header name, so we prefer currentEra.
        if (!currentEra) {
          if (!eraField) continue;
          currentEra = getEra(eraField);
        }
        if (!name) continue; // placeholder row with no copy
        addCopy(currentEra, row, name, extra, suberas[rowIdx]);
      } else {
        // Flat layout — group by the Era column; skip file-count summary rows.
        if (!eraField || isFileCountEra(row['Era'] ?? '')) continue;
        const era = getEra(eraField);
        if (!name) continue; // era placeholder with no copy yet
        addCopy(era, row, name, extra, suberas[rowIdx]);
      }
    }

    // Drop eras that ended up with no copies at all.
    const nonEmpty = eras.filter((e) => e.copies.length > 0);

    return csvResponse({ eras: nonEmpty });
  } catch (err) {
    return csvResponse({ eras: [] });
  }
};
