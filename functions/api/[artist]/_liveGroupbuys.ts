// Live Group Buys / Fundraisers tab: the tracker sheet's buys tab, read at
// request time (through its htmlview, see _sheetGrid.ts — works on
// download-disabled sheets without an API key) and normalized into the uniform
// groupbuys.csv schema groupbuys.ts reads:
//
//   Year,YearTotal,Era,Name,Content,Price,Start,End,Type,Status,Link
//
// Each sheet family's raw layout is reshaped by a port of the offline script
// that built its committed public/<slug>/data/groupbuys.csv snapshot — keep
// them in step:
//   generic → scripts/build-groupbuys-csvs.py normalize_generic
//   juice   → scripts/build-groupbuys-csvs.py normalize_juice
//   ye      → scripts/build-yegold-csvs.py / build-bigupdate-csvs.py build_groupbuys
//   ken     → scripts/build-kengold-metadata.py build_groupbuys
//   d4vd    → scripts/build-d4vdgold-csvs.py build_groupbuys
// The snapshot stays the fallback when the sheet can't be read or yields no buys.

import { joinCSVRows } from './_csvParser';
import { fetchSheetGrid, gridToRows } from './_sheetGrid';

type Kind = 'generic' | 'juice' | 'ye' | 'ken' | 'd4vd';

// slug → [spreadsheet id (or tracker-site origin), buys tab gid, normalizer]
export const GROUPBUY_SHEETS: Record<string, [string, string, Kind]> = {
  aapgold: ['1rbt_VyQyHEfVRv_XmVBNrwMyF0uMx7FF-1T8-N0wf0E', '2030937797', 'generic'],
  d4vdgold: ['1N6_EyCC6AM_cpFkIJivCN0kWzEwJRev7vQCmFAChnjk', '1797808886', 'd4vd'],
  doechiigold: ['1P2inSuDEuS_kp45qDAXJpb_hmj__Lj409bytyp4xiw8', '903917858', 'ye'],
  drizzygold: ['1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI', '910683927', 'generic'],
  gambinogold: ['1eyBjj7qPxIT_P93RaSPZf5hTJemGi5jMqSJF777OsdE', '2017407723', 'generic'],
  // The Juice tracker's Groupbuys tab only links to gabedoesntgaf's Groupbuy
  // Tracker; its Log tab is what the snapshot was built from.
  juicegold: ['1qWCsoTTGMiXxymTui319zFwMtpZE7a5SYqmybz6mkBY', '2005261126', 'juice'],
  kdotgold: ['1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI', '134922616', 'generic'],
  kengold: ['1OARID98xCqRaBr8gyQCvI3aD4jKQDGgtedyRaiP_pyo', '296594220', 'ken'],
  lonelygold: ['1J16EyxHqZD4m0VZ6g6SoY_1GC21TU7P2kk9FeteSKvE', '1354400493', 'generic'],
  macgold: ['17TycQCSpIm-6DyWId4ve8fVaM7Ewg3lgV1DDNRwauh0', '720288779', 'generic'],
  nasgold: ['1-UZb9y-GQB5v3sysdUlYBxfUKDu58_Cw-TqUd8-v4U4', '1841567237', 'ye'],
  shadygold: ['1x9tTOOqH5WpKOoptdQzABSN_x8oZbMgzIGlGH9w1IKA', '1527309975', 'generic'],
  trippiegold: ['1hZdGFBZmukWGH4IlnH0NJvphwEct2XEMJT_moTFhTvc', '882784660', 'ye'],
  twizzygold: ['1FUzAZyTCgFTVxQ--qbCAS2bUk4dsAw6ASxwjURPHbyI', '1080017795', 'generic'],
  tydollagold: ['11Kk3Mi8iiFmXEFV8vzcmTrnjcMkfgImABCavXhC4D48', '918136922', 'generic'],
  uzigold: ['1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo', '1849417942', 'generic'],
  vampgold: ['1Irtfvymu26CShYowLMMfD-rM0o9CJqE6-BBSlYsAaF4', '816874642', 'generic'],
  // The official Tyler tracker (via tylertracker.net, like wolfgold's other
  // tabs); the public wolfgold sheet's Fundraisers tab is a different list.
  wolfgold: ['https://tylertracker.net', '254817575', 'generic'],
  xgold: ['1vMEIba05N8zD2iSh_knAkAMzyrm9rtreu1NJeyNZj0I', '314951790', 'generic'],
  yecomgold: ['1JcJOHsNdCo7rBS6dbOUbBGjeq_CS8x0FqdW9_cnTozs', '1022200924', 'ye'],
  yegold: ['1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y', '1022200924', 'ye'],
  yelolgold: ['1wQ0WC0U9q10fLWpy9CO8YR128eE8msGXqtZI8_cNyTA', '1022200924', 'ye'],
  yzygold: ['12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM', '1022200924', 'generic'],
};

export const hasLiveGroupbuys = (artist: string): boolean => artist in GROUPBUY_SHEETS;

const FIELDS = ['Year', 'YearTotal', 'Era', 'Name', 'Content', 'Price', 'Start', 'End', 'Type', 'Status', 'Link'] as const;
type Buy = Record<(typeof FIELDS)[number], string>;

const clean = (s: string | undefined): string => (s ?? '').trim();
const at = (row: string[], i: number | null): string => (i !== null && i < row.length ? clean(row[i]) : '');

function mergeNotes(...parts: string[]): string {
  const out: string[] = [];
  for (const p of parts.map(clean)) if (p && !out.includes(p)) out.push(p);
  return out.join('\n\n');
}

// ── generic (build-groupbuys-csvs.py) ─────────────────────────────────────────

const YEAR_RE = /\b(20[0-3]\d)\b/;
const isBareYear = (s: string): boolean => /^20[0-3]\d$/.test(clean(s));

function findColFirstLine(headers: string[], ...needles: string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const hl = (headers[i] ?? '').split('\n')[0].toLowerCase();
    if (needles.some(n => hl.includes(n))) return i;
  }
  return null;
}

const parseYear = (...cells: string[]): string => {
  for (const c of cells) {
    const m = (c ?? '').match(YEAR_RE);
    if (m) return m[1];
  }
  return '';
};

function normalizeGeneric(rows: string[][]): [Buy[], string] {
  const headers = rows[0] ?? [];
  const eraI = findColFirstLine(headers, 'era');
  let nameI = findColFirstLine(headers, 'buy name');
  if (nameI === null) {
    const i = headers.findIndex(h => clean(h).toLowerCase() === 'name');
    nameI = i === -1 ? null : i;
  }
  if (nameI === null) nameI = findColFirstLine(headers, 'main content');
  const contentI = findColFirstLine(headers, 'all content', 'full content', 'buy content', 'notes');
  const priceI = findColFirstLine(headers, 'price');
  const startI = findColFirstLine(headers, 'start');
  const endI = findColFirstLine(headers, 'end');
  const typeI = findColFirstLine(headers, 'type');
  const statusI = findColFirstLine(headers, 'finished', 'state', 'status', 'completed', 'surfaced');
  const linkI = findColFirstLine(headers, 'link', 'snippet', 'server');

  const out: Buy[] = [];
  let grandTotal = '';
  let curYear = '';
  let curYearTotal = '';
  for (const row of rows.slice(1)) {
    if (!row.some(c => clean(c))) continue;
    const era = at(row, eraI);
    const name = at(row, nameI);
    const content = at(row, contentI);
    const price = at(row, priceI);
    const joined = row.map(clean).join(' ');

    if (/total/i.test(era) || /total/i.test(name) || (/total/i.test(content) && !name)) {
      const m = joined.match(/\$[\d,]+(?:\.\d+)?/);
      if (m && !grandTotal) grandTotal = m[0];
      continue;
    }
    if (/^upcoming buys?$/i.test(content.trim()) || /^upcoming buys?$/i.test(name.trim())) {
      curYear = 'Upcoming';
      curYearTotal = '';
      continue;
    }
    const yearCell = [era, name, content].find(isBareYear) ?? '';
    if (yearCell && !(name && !isBareYear(name))) {
      curYear = yearCell;
      curYearTotal = price;
      continue;
    }
    if (!name || name.toUpperCase() === 'PLACEHOLDER') continue;

    const year = curYear || parseYear(at(row, startI), at(row, endI));
    out.push({
      Year: year || 'Unknown',
      YearTotal: year === curYear ? curYearTotal : '',
      Era: era,
      Name: name,
      Content: content,
      Price: price,
      Start: at(row, startI),
      End: at(row, endI),
      Type: at(row, typeI),
      Status: at(row, statusI),
      Link: at(row, linkI),
    });
  }
  return [out, grandTotal];
}

// ── juice (build-groupbuys-csvs.py) ───────────────────────────────────────────

function normalizeJuice(rows: string[][]): [Buy[], string] {
  const out: Buy[] = [];
  let grandTotal = '';
  // The all-time total: the export's first row used to carry it in column 5;
  // the sheet now has a "Total: $…" row above the year sections.
  const m = (rows[0]?.[5] ?? '').match(/\$?([\d,]{5,})/)
    ?? rows.slice(0, 8).map(r => (r[0] ?? '').match(/^\s*total:?\s*\$?\s*([\d,]{5,})/i)).find(Boolean);
  if (m) grandTotal = '$' + m[1];
  const stripLabel = (s: string) => s.replace(/^(start|end)\s*date\.?\s*/i, '').trim();
  for (const row of rows.slice(1)) {
    if (!row.some(c => clean(c))) continue;
    const nameCell = at(row, 3);
    if (!nameCell) continue;
    // Year section rows ("2026 - Groupbuys / Personal Buys") and the column labels.
    if (!at(row, 1) && !at(row, 2) && /^\d{4}\b|^content advertised/i.test(nameCell)) continue;
    const lines = nameCell.split('\n');
    const name = lines[0].trim();
    const songs = lines.slice(1).filter(l => l.trim()).join('\n').trim();
    const start = stripLabel(at(row, 6));
    const end = stripLabel(at(row, 7));
    const info = at(row, 4);
    const content = [songs, info].filter(p => p && p !== '-').join('\n');
    const finished = at(row, 8);
    const surfaced = at(row, 9);
    const status: string[] = [];
    if (finished) {
      const f = finished.toUpperCase();
      status.push(f === 'TRUE' ? 'Finished' : f === 'FALSE' ? 'Unfinished' : finished);
    }
    if (surfaced.toUpperCase() === 'TRUE') status.push('Surfaced w/ OG');
    out.push({
      Year: parseYear(start, end) || 'Unknown',
      YearTotal: '',
      Era: at(row, 2),
      Name: name,
      Content: content,
      Price: at(row, 5),
      Start: start,
      End: end,
      Type: at(row, 1),
      Status: status.join(' / '),
      Link: '',
    });
  }
  return [out, grandTotal];
}

// ── ye / bigupdate (build-yegold-csvs.py) ─────────────────────────────────────

function findHeaderYe(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const firsts = rows[i].map(c => clean(c).split('\n')[0].trim().toLowerCase());
    if (firsts.some(f => ['name', 'title', 'main content', 'full content'].includes(f))) return i;
  }
  return 0;
}

// Python's `col(...) or col(...)` treats index 0 as missing; `||` does the same.
function colYe(headers: string[], ...keywords: string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const hl = clean(headers[i]).toLowerCase();
    if (keywords.every(k => hl.includes(k))) return i;
  }
  return null;
}

function normalizeYe(rows: string[][]): [Buy[], string] {
  const hi = findHeaderYe(rows);
  const h = rows[hi] ?? [];
  const ci = {
    content: colYe(h, 'main', 'content') || colYe(h, 'full', 'content') || colYe(h, 'content')
      || (colYe(h, 'name') || colYe(h, 'title')),
    allcontent: colYe(h, 'all', 'content'),
    price: colYe(h, 'price'),
    start: colYe(h, 'start'),
    end: colYe(h, 'end'),
    type: colYe(h, 'type'),
    status: colYe(h, 'finished') || colYe(h, 'state') || colYe(h, 'status'),
    link: colYe(h, 'link') || colYe(h, 'snippet') || colYe(h, 'source'),
  };
  const out: Buy[] = [];
  for (const r of rows.slice(hi + 1)) {
    const era = clean(r[0]);
    const content = at(r, ci.content ?? null);
    const name = content.split('\n')[0];
    if (!name) continue;
    const start = at(r, ci.start), end = at(r, ci.end);
    let year = '';
    for (const c of [end, start]) {
      const m = c.match(/\b(19|20)\d{2}\b/);
      if (m) { year = m[0]; break; }
    }
    out.push({
      Year: year || 'Unknown', YearTotal: '', Era: era, Name: name,
      Content: mergeNotes(content, at(r, ci.allcontent)), Price: at(r, ci.price),
      Start: start, End: end, Type: at(r, ci.type), Status: at(r, ci.status ?? null), Link: at(r, ci.link ?? null),
    });
  }
  return [out, ''];
}

// ── ken (build-kengold-metadata.py) ───────────────────────────────────────────

function normalizeKen(rows: string[][]): [Buy[], string] {
  const out: Buy[] = [];
  for (const row of rows.slice(1)) {
    const c = [...row.map(clean), ...Array(11).fill('')];
    const [era, name, info, price, end, type, state] = c;
    if (!name) continue;
    const m = end.match(YEAR_RE) ?? info.match(YEAR_RE);
    out.push({
      Year: m ? m[1] : 'Unknown', YearTotal: '', Era: era, Name: name, Content: info, Price: price,
      Start: '', End: end, Type: type, Status: state, Link: '',
    });
  }
  return [out, ''];
}

// ── d4vd (build-d4vdgold-csvs.py) ─────────────────────────────────────────────

function normalizeD4vd(rows: string[][]): [Buy[], string] {
  let hi = rows.findIndex(r => clean(r[0]) === 'Era');
  if (hi === -1) hi = 0;
  const out: Buy[] = [];
  for (const raw of rows.slice(hi + 1)) {
    const r = [...raw, ...Array(Math.max(0, 9 - raw.length)).fill('')];
    const [era, contents, notes, start, end, price, type, finished, link] = r;
    const name = clean(contents).split('\n')[0];
    if (!name) continue;
    out.push({
      Year: parseYear(start, end) || 'Unknown', YearTotal: '', Era: clean(era), Name: name,
      Content: mergeNotes(contents, notes), Price: clean(price), Start: clean(start), End: clean(end),
      Type: clean(type), Status: clean(finished), Link: clean(link),
    });
  }
  return [out, ''];
}

const NORMALIZERS: Record<Kind, (rows: string[][]) => [Buy[], string]> = {
  generic: normalizeGeneric,
  juice: normalizeJuice,
  ye: normalizeYe,
  ken: normalizeKen,
  d4vd: normalizeD4vd,
};

export function normalizeGroupbuys(kind: Kind, rows: string[][]): string {
  const [buys, grand] = NORMALIZERS[kind](rows);
  const out: string[][] = [[...FIELDS]];
  if (grand) out.push(['TOTAL', grand, '', '', '', '', '', '', '', '', '']);
  for (const b of buys) out.push(FIELDS.map(f => b[f]));
  return joinCSVRows(out);
}

// The live groupbuys.csv text for a tracker. Throws when the sheet can't be
// read or the tab yields no buys.
export async function fetchLiveGroupbuysCsv(artist: string): Promise<string> {
  const src = GROUPBUY_SHEETS[artist];
  if (!src) throw new Error('no live Group Buys tab');
  const [sheetId, gid, kind] = src;
  const rows = gridToRows(await fetchSheetGrid(sheetId, gid));
  const [buys] = NORMALIZERS[kind](rows);
  if (!buys.length) throw new Error('Group Buys tab had no buys');
  return normalizeGroupbuys(kind, rows);
}
