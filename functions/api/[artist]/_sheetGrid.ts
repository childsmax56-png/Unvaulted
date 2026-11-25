// A Google Sheet tab read from its public /htmlview as a grid of styled cells.
//
// The CSV export drops everything but text and 401s on download-disabled
// sheets; the Sheets API needs a key. The htmlview works on any public sheet
// (downloads disabled or not) and still carries what the Tracklists and Group
// Buys builders need: cell text, the cell's fill and text colour (CSS classes),
// rich-text colour runs (<span style="color:...">), real hyperlink targets and
// in-cell images. This is the live equivalent of the grid the offline builders
// (scripts/build-tracklists-enriched.py, scripts/build-groupbuys-csvs.py) read.
//
// Plain string parsing rather than HTMLRewriter so it also runs under Node for
// the comparison scripts.

export interface GridCell {
  text: string;
  // Cell fill / default text colour as lowercase "#rrggbb" (null when unset).
  fill: string | null;
  color: string | null;
  // Text split by colour; only set for rich-text cells (any inline span).
  runs: [string, string | null][] | null;
  // Hyperlink targets in the cell, in order (Google redirect wrappers removed).
  links: string[];
  // True when the cell holds an in-cell image.
  hasImage: boolean;
}

export interface GridRow {
  // 0-based sheet row (the htmlview's <th id="{gid}R{n}">).
  n: number;
  // 0-based column → cell. Columns account for colspan.
  cells: Map<number, GridCell>;
}

export const decodeEntities = (s: string): string => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const hexColor = (css: string, prop: string): string | null => {
  const m = css.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1].toLowerCase() : null;
};

// https://www.google.com/url?q=<target>&sa=D&... → <target>
export function unwrapGoogleUrl(href: string): string {
  const m = href.match(/^https?:\/\/www\.google\.com\/url\?q=([^&]+)/);
  if (!m) return href;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

function parseClasses(html: string): Map<string, { fill: string | null; color: string | null }> {
  const out = new Map<string, { fill: string | null; color: string | null }>();
  for (const m of html.matchAll(/\.ritz \.waffle \.(s\d+)\{([^}]*)\}/g)) {
    out.set(m[1], { fill: hexColor(m[2], 'background-color'), color: hexColor(m[2], 'color') });
  }
  return out;
}

const TOKEN_RE = /<br\s*\/?>|<span\b[^>]*>|<\/span>|<a\b[^>]*>|<img\b[^>]*>|<[^>]+>|[^<]+/g;

function parseCell(inner: string, color: string | null): Omit<GridCell, 'fill' | 'color'> {
  const runs: [string, string | null][] = [];
  const links: string[] = [];
  const stack: (string | null)[] = [];
  let styled = false;
  let hasImage = false;
  const push = (t: string) => {
    const c = stack.length ? stack[stack.length - 1] : color;
    const last = runs[runs.length - 1];
    if (last && last[1] === c) last[0] += t; else runs.push([t, c]);
  };
  for (const [tok] of inner.matchAll(TOKEN_RE)) {
    if (tok[0] !== '<') { push(decodeEntities(tok)); continue; }
    if (/^<br/i.test(tok)) { push('\n'); continue; }
    if (/^<span/i.test(tok)) {
      const style = decodeEntities(tok.match(/style="([^"]*)"/)?.[1] ?? '');
      const c = hexColor(style, 'color');
      // Any inline span means the cell is rich text: the Sheets API then sends
      // textFormatRuns (unstyled stretches in the cell's own colour), which is
      // what the offline builder coloured tracks from.
      styled = true;
      stack.push(c ?? (stack.length ? stack[stack.length - 1] : color));
      continue;
    }
    if (tok === '</span>') { stack.pop(); continue; }
    if (/^<a\b/i.test(tok)) {
      styled = true; // a link is a format run too
      const href = tok.match(/href="([^"]*)"/)?.[1];
      if (href) {
        const url = unwrapGoogleUrl(decodeEntities(href));
        if (!links.includes(url)) links.push(url);
      }
      continue;
    }
    if (/^<img\b/i.test(tok)) { hasImage = true; continue; }
    // Checkboxes render as an SVG <use>; the CSV export gives TRUE/FALSE.
    const box = tok.match(/^<use\b[^>]*href="#(un)?checked-checkbox-id"/);
    if (box) { push(box[1] ? 'FALSE' : 'TRUE'); continue; }
  }
  const text = runs.map(r => r[0]).join('');
  return { text, runs: styled ? runs : null, links, hasImage };
}

// Parse a tab's htmlview HTML into rows of cells.
export function parseSheetGrid(html: string): GridRow[] {
  const classes = parseClasses(html);
  const rows: GridRow[] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const body = tr[1];
    const id = body.match(/<th id="\d+R(\d+)"/);
    if (!id) continue; // column header / freeze bar rows
    const cells = new Map<number, GridCell>();
    let col = 0;
    for (const td of body.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)) {
      const attrs = td[1];
      const span = +(attrs.match(/colspan="(\d+)"/)?.[1] ?? 1);
      const cls = (attrs.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).find(c => classes.has(c));
      const style = cls ? classes.get(cls)! : { fill: null, color: null };
      const parsed = parseCell(td[2], style.color);
      if (parsed.text.trim() || parsed.hasImage || style.fill) {
        cells.set(col, { ...parsed, text: parsed.text.trim() ? parsed.text : '', fill: style.fill, color: style.color });
      }
      col += span;
    }
    rows.push({ n: +id[1], cells });
  }
  return rows;
}

// `sheetId` may instead be a tracker site's origin (https://…) that publishes
// the sheet's tabs as the same markup at /preview/sheet/{gid}.html (see
// _franktracker.ts).
export async function fetchSheetGrid(sheetId: string, gid: string): Promise<GridRow[]> {
  const url = sheetId.startsWith('https://')
    ? `${sheetId}/preview/sheet/${gid}.html`
    : `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview/sheet?headers=true&gid=${gid}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Sheet htmlview HTTP ${res.status}`);
  const rows = parseSheetGrid(await res.text());
  if (!rows.length) throw new Error('Sheet htmlview had no rows');
  return rows;
}

// Grid → plain text rows like the CSV export: index = row position in the
// grid, cells padded to the widest row.
export function gridToRows(grid: GridRow[]): string[][] {
  const width = Math.max(0, ...grid.flatMap(r => [...r.cells.keys()].map(c => c + 1)));
  return grid.map(r => Array.from({ length: width }, (_, c) => (r.cells.get(c)?.text ?? '').trim()));
}
