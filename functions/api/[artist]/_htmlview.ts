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

// Ask Google for a bigger rendition than the thumbnail the view embeds, served
// through our /api/sheet-image proxy (the raw URL fails for browsers that send
// Google cookies). Non-sheets-images URLs are returned unchanged.
export function sheetImageUrl(src: string, width: number): string {
  const m = src.match(/^https:\/\/docs\.google\.com\/sheets-images-rt\/([A-Za-z0-9_-]+)/);
  return m ? `/api/sheet-image?u=${m[1]}=w${width}` : src;
}

export async function fetchSheetRowImages(
  sheetId: string,
  gid: string,
  opts: { withText?: boolean; width?: number } = {},
): Promise<Map<number, HtmlviewRow>> {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview/sheet?headers=true&gid=${gid}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  if (!res.ok) throw new Error(`Sheet htmlview HTTP ${res.status}`);

  const rows = new Map<number, HtmlviewRow>();
  let current: HtmlviewRow | null = null;
  let cell = -1;
  const width = opts.width ?? 1000;

  const rewriter = new HTMLRewriter()
    .on('tr', {
      element() { current = { images: [], imageCells: [], cells: opts.withText ? [] : undefined }; cell = -1; },
    })
    .on('th', {
      element(el) {
        const m = (el.getAttribute('id') ?? '').match(/R(\d+)$/);
        if (m && current) rows.set(+m[1], current);
      },
    })
    .on('td', {
      element() { cell++; current?.cells?.push(''); },
      text(t) { if (current?.cells && cell >= 0) current.cells[cell] += t.text; },
    })
    .on('td br', {
      element() { if (current?.cells && cell >= 0) current.cells[cell] += '\n'; },
    })
    .on('td img', {
      element(el) {
        const src = el.getAttribute('src') ?? '';
        if (current && /^https:\/\/[^/]*google[^/]*\//.test(src)) {
          current.images.push(sheetImageUrl(decodeEntities(src), width));
          current.imageCells.push(cell);
        }
      },
    });

  // Drain the transformed stream; the handlers above do the work.
  await rewriter.transform(res).arrayBuffer();

  // Only keep rows that carry something worth joining.
  for (const [n, row] of rows) {
    if (row.cells) row.cells = row.cells.map(c => decodeEntities(c).trim());
    if (!row.images.length && !opts.withText) rows.delete(n);
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
