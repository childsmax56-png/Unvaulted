import { parseCSV, csvResponse } from './_csvParser';
import { fetchTrackerCsv } from './_sheets';

// "Individual Projects" tab: a second, independent Unreleased-style catalog for
// trackers whose sheet has a separate tab for something outside the main group
// discography (e.g. wutanggold's members' solo/collab albums). Reuses the exact
// same era-grouping approach as the main Unreleased tab (functions/api/[artist]/a.ts):
// a multi-line "Era" cell marks a header/banner row whose Name cell holds the real
// era title, and every other row's Era cell is the era a song belongs to.
function parseSongName(raw: string): { name: string; extra: string | undefined } {
  const newline = raw.indexOf('\n');
  if (newline === -1) return { name: raw.trim(), extra: undefined };
  const name = raw.substring(0, newline).trim();
  const extra = raw.substring(newline).trim().replace(/^\n+/, '') || undefined;
  return { name, extra };
}

const isCsvText = (t: string) => !t.trimStart().startsWith('<');

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const artist = (context.params as Record<string, string>).artist ?? 'wutanggold';

    const text = await fetchTrackerCsv(url.origin, artist, 'individual', context.env as Env, context.request);
    if (text === null) return new Response('CSV not found', { status: 404 });
    if (!isCsvText(text)) return new Response('CSV not found', { status: 404 });

    const rows = parseCSV(text);

    const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    const NAME_KEY = firstRowKeys.find(k => k.startsWith('Name')) ?? 'Name';
    const NOTES_KEY = firstRowKeys.find(k => k === 'Notes') ?? firstRowKeys.find(k => k.startsWith('Notes')) ?? 'Notes';
    const TRACK_LENGTH_KEY = firstRowKeys.find(k => k === 'Track Length') ?? firstRowKeys.find(k => k === 'Length') ?? 'Track Length';
    const AVAIL_LENGTH_KEY = firstRowKeys.find(k => k === 'Portion') ?? firstRowKeys.find(k => k === 'Available Length') ?? 'Portion';
    const DATE_KEY = firstRowKeys.find(k => k.startsWith('Obtained')) ?? firstRowKeys.find(k => k === 'Origin') ?? firstRowKeys.find(k => k === 'File Date') ?? 'Origin';
    const LINKS_KEY = firstRowKeys.find(k => k === 'Link(s)') ?? firstRowKeys.find(k => k === 'Source') ?? firstRowKeys.find(k => k === 'Link') ?? 'Link(s)';

    const eras: Record<string, any> = {};

    // Junk-text guard for stray changelog/credits rows that share the Era column
    // (see the matching guard in a.ts) — a long sentence or a dated changelog line.
    const isJunkEraText = (s: string): boolean =>
      s.length > 120
      || /^\d{1,2}\/\d{1,2}\/\d{2,4}:/.test(s)
      || /^(Update Notes|Tracker Guidelines|Links)$/i.test(s)
      || /^(Note:|Special (thanks|thank)|THIS TAB)/i.test(s);

    // First pass: collect real era names from header rows (Era cell has a newline;
    // the real name is the Name cell). Stats rows also have newlines but their Name
    // starts with a digit or emoji count summary — skip those.
    const validEraNames = new Set<string>();
    for (const row of rows) {
      const eraField = row['Era'] ?? '';
      if (!eraField.includes('\n')) continue;
      const { name: eraName } = parseSongName(row[NAME_KEY] ?? '');
      if (eraName && !/^\d+\s/.test(eraName)) {
        validEraNames.add(eraName);
      }
    }

    // Supplement with song-row era names so eras with songs but no header row aren't dropped.
    for (const row of rows) {
      const eraField = (row['Era'] ?? '').trim();
      if (eraField && !eraField.includes('\n') && !isJunkEraText(eraField)) {
        validEraNames.add(eraField);
      }
    }

    for (const row of rows) {
      const eraField = row['Era'] ?? '';
      const nameField = row[NAME_KEY] ?? '';

      if (eraField.includes('\n')) {
        const { name: rawName, extra } = parseSongName(nameField);
        if (!rawName || !validEraNames.has(rawName)) continue;

        eras[rawName] = {
          name: rawName,
          extra: extra ?? undefined,
          timeline: row[NOTES_KEY]?.trim() || undefined,
          fileInfo: eraField.split('\n').map((l: string) => l.trim()).filter(Boolean),
          data: { 'Unreleased Tracks': [] },
        };
      } else if (eraField && validEraNames.has(eraField.trim())) {
        const eraName = eraField.trim();
        if (!eras[eraName]) {
          eras[eraName] = { name: eraName, data: { 'Unreleased Tracks': [] } };
        }

        const { name, extra } = parseSongName(nameField);
        const links = (row[LINKS_KEY] ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean);

        eras[eraName].data['Unreleased Tracks'].push({
          name,
          extra: extra ?? undefined,
          description: row[NOTES_KEY] ?? '',
          track_length: row[TRACK_LENGTH_KEY] ?? '',
          file_date: row[DATE_KEY] ?? '',
          leak_date: row[DATE_KEY] ?? '',
          available_length: row[AVAIL_LENGTH_KEY] ?? '',
          quality: row['Quality'] ?? '',
          url: links[0] ?? '',
          urls: links,
        });
      }
    }

    return csvResponse({ name: 'Individual Projects', tabs: ['eras'], current_tab: 'eras', eras });
  } catch (err) {
    return new Response('Failed to build individual projects data', { status: 500 });
  }
};
