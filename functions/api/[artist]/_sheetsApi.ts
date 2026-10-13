// Live tracker data via the Google Sheets API v4 (request-time reconstruction).
//
// Some trackers point at Google Sheets that have download/print/copy DISABLED,
// so `export?format=csv` 403s and every gviz export only returns a hyperlink's
// display text ("Pillowcase"), never the href. For those we can't use the plain
// CSV live-sync in _sheets.ts. Instead we read the sheet's grid via the Sheets
// API (`spreadsheets.get?includeGridData`), which exposes real hrefs
// (cell.hyperlink + textFormatRuns[].format.link.uri) alongside the cell text.
//
// The raw sheet columns don't match the canonical schema the app expects
// (a.ts / the frontend key on headers like "Name", "Link(s)", "Available
// Length", "Type"), so each tab is reshaped by an explicit column spec below.
// The committed public/<slug>/data/*.csv snapshots were curated to that same
// schema, so the reconstructed CSV is a drop-in live replacement and falls back
// to the snapshot when the API key is missing or the fetch fails.
//
// Requires env.GOOGLE_SHEETS_API_KEY (a Google Cloud key with the Sheets API
// enabled; works on any "anyone with the link can view" sheet, no OAuth).

// Where each output column's value comes from:
//   number  -> raw cell at that column index (formattedValue)
//   'LINKS' -> every unique href found anywhere in the row, newline-joined
//   'TYPE'  -> derived from the current section header (see `sections`)
//   'EMPTY' -> always blank (canonical column the raw sheet doesn't carry)
type ColSrc = number | 'LINKS' | 'TYPE' | 'EMPTY';

interface TabSpec {
  gid: string;
  title: string; // sheet tab title, used for the API `ranges` param
  columns: { out: string; src: ColSrc }[];
  // released-only: map a section-divider label -> a released.ts VALID_TYPE.
  sections?: Record<string, string>;
}

interface ApiSource {
  sheetId: string;
  tabs: Record<string, TabSpec>;
}

// Section label -> Type for the Released tab. Unknown sections fall back to
// 'Other' so no row is dropped by released.ts's VALID_TYPES filter. These are a
// best-effort mapping of the sheet's own sections; the hand-curated committed
// Type labels were assigned differently, so live Type badges may differ.
const RELEASED_SECTIONS: Record<string, string> = {
  Features: 'Feature',
  Feature: 'Feature',
  Project: 'Album Track',
  Projects: 'Album Track',
  Albums: 'Album Track',
  'Album Tracks': 'Album Track',
  Singles: 'Single',
  Single: 'Single',
  Loosies: 'Single',
  Production: 'Production',
  Samples: 'Production',
  Other: 'Other',
};

const API_SOURCES: Record<string, ApiSource> = {
  cactigold: {
    sheetId: '1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo',
    tabs: {
      // raw: [" Era","Title","","Notes","Length","File Date","Leak Date","What's Available?","Sources","Links"]
      unreleased: {
        gid: '1807066929',
        title: 'Unreleased',
        columns: [
          { out: 'Era', src: 0 },
          { out: 'Name', src: 1 },
          { out: 'Notes', src: 3 },
          { out: 'Track Length', src: 4 },
          { out: 'File Date', src: 5 },
          { out: 'Leak Date', src: 6 },
          { out: 'Available Length', src: 7 },
          { out: 'Quality', src: 8 },
          { out: 'Link(s)', src: 'LINKS' },
        ],
      },
      // raw: ["Era","Title","","Notes","Length","Release Date","Streaming?","Sources","Links"]
      released: {
        gid: '1137563349',
        title: 'Released',
        sections: RELEASED_SECTIONS,
        columns: [
          { out: 'Era', src: 0 },
          { out: 'Name', src: 1 },
          { out: 'Notes', src: 3 },
          { out: 'Length', src: 4 },
          { out: 'Release Date', src: 5 },
          { out: 'Type', src: 'TYPE' },
          { out: 'Streaming', src: 6 },
          { out: 'Link(s)', src: 'LINKS' },
        ],
      },
      // raw: ["Era","Title","","Notes","","What's new?","Links"] (already canonical)
      recent: {
        gid: '846204501',
        title: 'Recent',
        columns: [
          { out: 'Era', src: 0 },
          { out: 'Title', src: 1 },
          { out: '', src: 'EMPTY' },
          { out: 'Notes', src: 3 },
          { out: '', src: 'EMPTY' },
          { out: "What's new?", src: 5 },
          { out: 'Links', src: 'LINKS' },
        ],
      },
      // raw: ["Era","Title","","Notes","Drop Date","What's Available?","Sources","Links"]
      stems: {
        gid: '1984232945',
        title: 'Stems',
        columns: [
          { out: 'Era', src: 0 },
          { out: 'Name', src: 1 },
          { out: 'Notes', src: 3 },
          { out: 'File Date', src: 'EMPTY' },
          { out: 'Leak Date', src: 4 },
          { out: 'Full Length', src: 'EMPTY' },
          { out: 'BPM', src: 'EMPTY' },
          { out: 'Available Length', src: 5 },
          { out: 'Quality', src: 'EMPTY' },
          { out: 'Link(s)', src: 'LINKS' },
        ],
      },
      // raw: ["Era","Title","Notes","","Image","","Quality","Links"]
      tracklists: {
        gid: '1956640286',
        title: 'Tracklists',
        columns: [
          { out: 'Era', src: 0 },
          { out: 'Name', src: 1 },
          { out: 'Tracklist', src: 2 },
          { out: 'Image', src: 4 },
          { out: 'Date Made', src: 'EMPTY' },
          { out: 'Quality', src: 6 },
          { out: 'Source', src: 'EMPTY' },
          { out: 'Link(s)', src: 'LINKS' },
        ],
      },
      // raw: [" ","Title","","Notes","Type","Sources"] (era value sits in col 0)
      fakes: {
        gid: '1615755984',
        title: 'Fakes',
        columns: [
          { out: 'Era', src: 0 },
          { out: 'Name', src: 1 },
          { out: 'Notes', src: 3 },
          { out: 'Made By', src: 'EMPTY' },
          { out: 'Type', src: 4 },
          { out: 'Available Length', src: 'EMPTY' },
          { out: 'Link(s)', src: 'LINKS' },
        ],
      },
    },
  },
};

export function hasSheetApiSource(artist: string, tab: string): boolean {
  return !!API_SOURCES[artist]?.tabs[tab];
}

// ---------------------------------------------------------------------------
// Sheets API cell helpers
// ---------------------------------------------------------------------------
interface ApiCell {
  formattedValue?: string;
  hyperlink?: string;
  textFormatRuns?: { format?: { link?: { uri?: string } } }[];
}

const cellText = (c: ApiCell | undefined): string => c?.formattedValue ?? '';

function cellHrefs(c: ApiCell | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.hyperlink) out.push(c.hyperlink);
  for (const run of c.textFormatRuns || []) {
    const uri = run.format?.link?.uri;
    if (uri) out.push(uri);
  }
  // Also catch links pasted as plain text (no hyperlink attached) — but only when
  // the whole cell IS a bare URL, so URLs mentioned inside prose Notes aren't scraped.
  const text = (c.formattedValue ?? '').trim();
  if (out.length === 0 && /^https?:\/\/\S+$/.test(text)) out.push(text);
  return out;
}

const csvEscape = (s: string): string => '"' + String(s ?? '').replace(/"/g, '""') + '"';

// ---------------------------------------------------------------------------
// Reconstruct a tracker tab's canonical CSV from the live Sheets API grid.
// Returns null if there's no API source for this tab, no key, or the fetch fails
// (caller then falls back to the committed CSV snapshot).
// ---------------------------------------------------------------------------
export async function fetchSheetApiCsv(
  artist: string,
  tab: string,
  apiKey: string | undefined,
): Promise<string | null> {
  const source = API_SOURCES[artist];
  const spec = source?.tabs[tab];
  if (!source || !spec || !apiKey) return null;

  const fields = 'sheets(properties(sheetId),data.rowData.values(formattedValue,hyperlink,textFormatRuns))';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${source.sheetId}` +
    `?includeGridData=true&ranges=${encodeURIComponent(spec.title)}` +
    `&fields=${encodeURIComponent(fields)}&key=${apiKey}`;

  let grid: { values?: ApiCell[] }[];
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json() as {
      sheets?: { properties?: { sheetId?: number }; data?: { rowData?: { values?: ApiCell[] }[] }[] }[];
    };
    const sheet = doc.sheets?.find(s => String(s.properties?.sheetId) === spec.gid) ?? doc.sheets?.[0];
    grid = sheet?.data?.[0]?.rowData ?? [];
  } catch {
    return null;
  }
  if (!grid.length) return null;

  // Header row: the first row whose 2nd cell is "Title" (true across every tab,
  // including Fakes whose 1st column header is blank).
  const headerIdx = grid.findIndex(r => cellText(r.values?.[1]).trim() === 'Title');
  if (headerIdx < 0) return null;

  const lines: string[] = [spec.columns.map(c => csvEscape(c.out)).join(',')];
  let currentType = 'Other';

  for (const row of grid.slice(headerIdx + 1)) {
    const cells = row.values ?? [];
    const era = cellText(cells[0]).trim();
    const name = cellText(cells[1]).trim(); // col 1 is Title/Name across every tab

    // A real song row has BOTH an era and a name. Rows with an era value but no
    // name are disclaimer/banner rows (e.g. "| Last Updated… |", "⚠️ Imgur…")
    // that sit between the header and the data — skip them.
    if (era && !name) continue;

    // Non-song rows have a blank Era cell: era-header rows (title carries the era
    // name/years + a long description) and section dividers (a short label alone).
    if (!era) {
      if (spec.sections) {
        const label = cellText(cells[1]).trim();
        const notesBlank = !cellText(cells[3]).trim();
        // Section divider: a short single-line label with no description; era
        // headers instead have a newline in the title and/or a filled Notes cell.
        if (label && notesBlank && !label.includes('\n')) {
          currentType = spec.sections[label] ?? 'Other';
        }
      }
      continue;
    }

    const rowHrefs = [...new Set(cells.flatMap(cellHrefs))];
    const out = spec.columns.map(col => {
      if (col.src === 'LINKS') return csvEscape(rowHrefs.join('\n'));
      if (col.src === 'TYPE') return csvEscape(currentType);
      if (col.src === 'EMPTY') return csvEscape('');
      return csvEscape(cellText(cells[col.src]));
    });
    lines.push(out.join(','));
  }

  return lines.join('\n') + '\n';
}
