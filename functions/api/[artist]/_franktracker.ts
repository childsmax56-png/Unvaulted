import { joinCSVRows } from './_csvParser';

// Live source for frankgold. Its Google Sheet is gone (export HTTP 410), but
// franktracker.net still publishes every tab as a static published-sheet HTML
// table at /preview/sheet/{gid} (Google's "waffle" markup). Fetch that table at
// request time and rebuild the CSV the committed snapshot holds; on any failure
// the caller falls back to that snapshot.

interface SiteSource {
  origin: string;
  gids: Record<string, string>;
}

const SITE_SOURCES: Record<string, SiteSource> = {
  frankgold: {
    origin: 'https://franktracker.net',
    gids: {
      unreleased: '44489322',
      released: '1454863518',
      recent: '1122958563',
      tracklists: '1543259143',
      stems: '1010941390',
      'album-copies': '1324887433',
      'music-videos': '1257792866',
      fakes: '510511701',
      // art (gid 1257812670) stays on the committed CSV: the site's Art table has
      // lost nearly all its images, while the snapshot points at artwork saved
      // under public/frankgold/art/.
    },
  },
};

// Columns the site has but the views don't read (the snapshot never had them).
const DROP_HEADERS = new Set(['Mirror Link']);

export function hasSiteSource(artist: string, tab: string): boolean {
  return !!SITE_SOURCES[artist]?.gids[tab];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const toText = (html: string): string =>
  decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));

// One <td>'s inner HTML -> cell text. <br> becomes a newline; a cell whose links
// are only labels ("Link", "Snippet") gets the hrefs instead of the label text,
// and a link inside prose keeps its text followed by " <href>" (the snapshot's
// format) unless the text already is the URL.
function cellText(inner: string): string {
  const text = toText(inner).trim();
  const hrefs = [...inner.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map(m => decodeEntities(m[1]));
  if (!hrefs.length) return text;
  if (!/https?:\/\//.test(text) && text.split('\n').every(l => l.trim().length <= 20)) {
    return [...new Set(hrefs)].join('\n');
  }
  return toText(inner.replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href: string, body: string) => {
    const label = toText(body).trim();
    const url = decodeEntities(href);
    return label === url ? body : `${body} &lt;${href}&gt;`;
  })).trim();
}

// Published-sheet HTML table -> grid rows (sheet rows only; the freeze-bar and
// column-header rows have no R{n} row id). colspan cells are padded with blanks
// so later cells keep their column.
export function parseWaffleTable(html: string): string[][] {
  const rows: string[][] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (!/<th\b[^>]*\bid="[^"]*R\d+"/i.test(tr[1])) continue;
    const row: string[] = [];
    for (const td of tr[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
      row.push(cellText(td[2]));
      const span = Number(/colspan="(\d+)"/i.exec(td[1])?.[1] ?? 1);
      for (let i = 1; i < span; i++) row.push('');
    }
    rows.push(row);
  }
  return rows;
}

// Grid rows -> the snapshot's CSV shape: start at the header row (banner rows
// above it dropped), header cells cut to their first line ("Name\n(Check out
// the Tracker website!)" -> "Name") with wrapped words joined ("File \nDate"),
// unused columns dropped, trailing blank columns trimmed.
export function toTrackerCsv(rows: string[][]): string {
  const h = rows.findIndex(r => (r[0] ?? '').trim() === 'Era' || r.some(c => /^Name\b/.test(c.trim())));
  if (h === -1) throw new Error('no header row');
  const header = rows[h].map(c => {
    const lines = c.split('\n').map(l => l.trim());
    // a hint line in parentheses is dropped; a wrapped word is joined
    const kept = lines.filter((l, i) => i === 0 || (l && !l.startsWith('(')));
    return kept.join(' ').replace(/\s+/g, ' ').trim();
  });
  let width = header.length;
  while (width > 0 && !header[width - 1]) width--;
  const keep = header.map((c, i) => i < width && !DROP_HEADERS.has(c)).flatMap((k, i) => (k ? [i] : []));
  const out = [keep.map(i => header[i])];
  for (const r of rows.slice(h + 1)) {
    if (!r.some(c => c.trim())) continue;
    out.push(keep.map(i => r[i] ?? ''));
  }
  return joinCSVRows(out);
}

export async function fetchSiteCsv(artist: string, tab: string): Promise<string> {
  const src = SITE_SOURCES[artist];
  const gid = src?.gids[tab];
  if (!src || !gid) throw new Error('no site source');
  const res = await fetch(`${src.origin}/preview/sheet/${gid}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Tracker site HTTP ${res.status}`);
  const rows = parseWaffleTable(await res.text());
  const csv = toTrackerCsv(rows);
  // A layout change that leaves almost nothing parseable shouldn't blank the tab.
  if (rows.length < 3) throw new Error('site table is empty');
  return csv;
}
