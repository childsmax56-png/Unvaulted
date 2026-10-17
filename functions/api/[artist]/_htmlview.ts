// In-cell images from a public Google Sheet's /htmlview.
//
// Era covers (Unreleased tab era-header rows) and Art-tab images are pasted
// into the sheets as "image in cell". The CSV export leaves those cells blank
// and the Sheets API doesn't expose them either — the only public place their
// URLs appear is the sheet's HTML view, which renders each one as
// <img src="https://docs.google.com/sheets-images-rt/...=wNNN-hNNN">. Those URLs
// fetch without auth and resize via the trailing =w param.
//
// Each <tr> carries a <th id="{gid}R{n}"> where n is the 0-based sheet row —
// the same index as that row in the tab's CSV export / Sheets API grid, so
// images can be joined back onto export rows by index.

export interface HtmlviewRow {
  images: string[];
  // Cell index (0-based <td> position) of each entry in `images`.
  imageCells: number[];
  // Visible text of the row's cells, in order (<br> → "\n"). Only collected
  // when requested — the Unreleased view is ~10MB.
  cells?: string[];
}

const decodeEntities = (s: string): string => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// The sheets-images-rt tokens in the view rotate every few minutes and the old
// ones then 403, so they can't be handed to browsers (or cached by token). Each
// image is instead addressed by a stable key — a fingerprint of its row's text
// plus its cell position — via /api/sheet-image?s=&g=&k=&w=. That proxy maps the
// key back to a current token using the token map this function caches (or by
// re-reading the view), then stores the image in R2.
//
// The rewritten URLs are relative (/api/sheet-image?...), served same-origin —
// the raw Google URLs also fail in browsers (CORP same-site).

const TOKEN_MAP_TTL = 3 * 60; // shorter than the token lifetime

const tokenMapKey = (sheetId: string, gid: string) =>
  new Request(`https://sheet-image.cache/map/${sheetId}/${gid}`);

// FNV-1a, two 32-bit lanes → 16 hex chars. Only needs to tell rows apart.
function fingerprint(text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export const sheetImageUrl = (sheetId: string, gid: string, key: string, width: number): string =>
  `/api/sheet-image?s=${sheetId}&g=${gid}&k=${key}&w=${width}`;

// key ("{fingerprint}-{cell}") → current token, read from a fresh htmlview.
export async function getSheetImageTokens(sheetId: string, gid: string): Promise<Record<string, string>> {
  const hit = await caches.default.match(tokenMapKey(sheetId, gid));
  if (hit) return hit.json();
  return (await scrapeSheetView(sheetId, gid)).tokens;
}

interface RawRow { images: string[]; imageCells: number[]; cells: string[] }

async function scrapeSheetView(sheetId: string, gid: string): Promise<{
  rows: Map<number, RawRow>; tokens: Record<string, string>;
}> {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview/sheet?headers=true&gid=${gid}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  if (!res.ok) throw new Error(`Sheet htmlview HTTP ${res.status}`);

  const rows = new Map<number, RawRow>();
  let current: RawRow | null = null;
  let cell = -1;

  const rewriter = new HTMLRewriter()
    .on('tr', {
      element() { current = { images: [], imageCells: [], cells: [] }; cell = -1; },
    })
    .on('th', {
      element(el) {
        const m = (el.getAttribute('id') ?? '').match(/R(\d+)$/);
        if (m && current) rows.set(+m[1], current);
      },
    })
    .on('td', {
      element() { cell++; current?.cells.push(''); },
      text(t) { if (current && cell >= 0) current.cells[cell] += t.text; },
    })
    .on('td br', {
      element() { if (current && cell >= 0) current.cells[cell] += '\n'; },
    })
    .on('td img', {
      element(el) {
        const m = decodeEntities(el.getAttribute('src') ?? '')
          .match(/^https:\/\/docs\.google\.com\/sheets-images-rt\/([A-Za-z0-9_-]+)/);
        if (current && m) {
          current.images.push(m[1]);
          current.imageCells.push(cell);
        }
      },
    });

  // Drain the transformed stream; the handlers above do the work.
  await rewriter.transform(res).arrayBuffer();

  const tokens: Record<string, string> = {};
  for (const row of rows.values()) {
    row.cells = row.cells.map(c => decodeEntities(c).trim());
    if (!row.images.length) continue;
    const fp = fingerprint(row.cells.join('\u0001'));
    // Replace each token with its stable key.
    row.images = row.images.map((token, i) => {
      const key = `${fp}-${row.imageCells[i]}`;
      tokens[key] = token;
      return key;
    });
  }
  await caches.default.put(tokenMapKey(sheetId, gid), new Response(JSON.stringify(tokens), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TOKEN_MAP_TTL}` },
  }));
  return { rows, tokens };
}

export async function fetchSheetRowImages(
  sheetId: string,
  gid: string,
  opts: { withText?: boolean; width?: number } = {},
): Promise<Map<number, HtmlviewRow>> {
  const { rows: raw } = await scrapeSheetView(sheetId, gid);
  const width = opts.width ?? 1000;
  const rows = new Map<number, HtmlviewRow>();
  for (const [n, row] of raw) {
    if (!row.images.length && !opts.withText) continue;
    rows.set(n, {
      images: row.images.map(key => sheetImageUrl(sheetId, gid, key, width)),
      imageCells: row.imageCells,
      cells: opts.withText ? row.cells : undefined,
    });
  }
  return rows;
}

// Fill a tab's image column from its in-cell images: rows are the tab's raw
// export/API rows (index = sheet row). Images go into the row's Link(s)/Link
// column (what ArtGallery reads) when that cell has no URL; a Link(s) column is
// appended when the tab has none (e.g. yzygold's Art tab is images-only).
export function fillRowsWithImages(rows: string[][], images: Map<number, HtmlviewRow>): string[][] {
  if (!images.size) return rows;
  const h = rows.findIndex(r => r.some(c => /^\s*name\b/i.test(c)) && r.some(c => /^\s*(image|link|art|cover)/i.test(c)));
  if (h === -1) return rows;
  const header = rows[h];
  const clean = (c: string) => c.replace(/\s+/g, ' ').trim();
  let col = header.findIndex(c => /^links?(\(s\))?(\s|$)/i.test(clean(c)));
  if (col === -1) {
    col = header.length;
    header.push('Link(s)');
  }
  for (let i = h + 1; i < rows.length; i++) {
    const img = images.get(i)?.images[0];
    if (!img) continue;
    const row = rows[i];
    while (row.length <= col) row.push('');
    if (!/https?:\/\//i.test(row[col])) row[col] = img;
  }
  return rows;
}
