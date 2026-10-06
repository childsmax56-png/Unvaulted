// Live sync for trackers imported by scripts/build-bigupdate-csvs.py.
//
// Those trackers' raw sheets don't match the schema a.ts / the tab endpoints
// expect: era headers with the file counts in a later column or on one line,
// era names spelled differently on song rows vs their header, headers listed
// below their first songs, links split across several columns. The importer
// fixes all of that when it writes the committed CSVs, so serving the raw sheet
// export (the plain SHEET_SOURCES path in _sheets.ts) would undo it. Instead
// these trackers fetch the raw tab at request time and run it through this
// port of the importer's transforms, producing the same canonical CSV the
// committed snapshot has. On any failure the caller falls back to that
// snapshot.
//
// Keep the transforms (and ERA_FIXES) in step with scripts/build-bigupdate-csvs.py.

import { splitCSVRows, joinCSVRows } from './_csvParser';

type Kind = 'unreleased' | 'released' | 'stems' | 'fakes' | 'passthrough' | 'recent-from-unreleased';

interface ImportedTab {
  gid: string;
  kind: Kind;
  // 'api': read the grid via the Sheets API (export 401s, or links are
  // display-text-only hyperlinks the CSV export drops). Needs `title`.
  via?: 'api';
  title?: string;
}

interface ImportedSource {
  sheetId: string;
  tabs: Record<string, ImportedTab>;
}

const t = (gid: string, kind: Kind, api?: string): ImportedTab =>
  api ? { gid, kind, via: 'api', title: api } : { gid, kind };

// Tracklists aren't listed: that tab renders from the committed Tracklists.json.
const IMPORTED_SOURCES: Record<string, ImportedSource> = {
  clipsegold: {
    sheetId: '1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ',
    tabs: {
      unreleased: t('1520634709', 'unreleased'),
      released: t('197122594', 'released'),
      recent: t('2048130339', 'unreleased'),
      stems: t('465517202', 'stems'),
      art: t('1835098630', 'passthrough'),
      misc: t('961984580', 'passthrough'),
    },
  },
  daxgold: {
    sheetId: '1t1IuCgKrx3QjCt9CLrcu3FqA32qGAF8TeQjhCQHO4AY',
    tabs: {
      unreleased: t('199908479', 'unreleased', 'Unreleased (WIP)'),
      released: t('1295931150', 'released', 'Released (WIP)'),
      recent: t('1385926980', 'unreleased', 'Recent'),
    },
  },
  deathgripsgold: {
    sheetId: '1Eh-9UyWUtyEpi_ELEhq5pD41ivFJHuQcvz2wFR2ml9g',
    tabs: {
      unreleased: t('0', 'unreleased'),
      recent: t('0', 'recent-from-unreleased'),
      released: t('1874184279', 'released'),
      art: t('171524654', 'passthrough'),
      'album-copies': t('1083177166', 'passthrough'),
      stems: t('1642376975', 'stems'),
      'music-videos': t('677046238', 'passthrough'),
      misc: t('279373297', 'passthrough'),
      fakes: t('308208459', 'fakes'),
    },
  },
  delasoulgold: {
    sheetId: '19KA4hq1j8sVhTEt4gqWWn6Potw9N_IGGJ2bwgZeVYHI',
    tabs: {
      unreleased: t('1493533867', 'unreleased', 'Unreleased'), // API: 2 links are hyperlink-only
      released: t('1686511551', 'released'),
      recent: t('120005814', 'unreleased'),
    },
  },
  premiergold: {
    sheetId: '1RaAzCb3IAg0FZas9dsAMqU785xw1sDYIvx3-SVFEVsY',
    tabs: {
      unreleased: t('306146520', 'unreleased'),
      recent: t('138343535', 'unreleased'),
      released: t('75249724', 'released'),
    },
  },
  dmxgold: {
    sheetId: '101y0kCIzwGoT0YmGHIchehUpO7tzAdjXSZZVRrEobOg',
    tabs: {
      unreleased: t('1792554832', 'unreleased'),
      recent: t('1792554832', 'recent-from-unreleased'),
      released: t('1452347467', 'released'),
      stems: t('965054462', 'stems'),
      misc: t('531726349', 'passthrough'),
      fakes: t('336831316', 'fakes'),
    },
  },
  dualipagold: {
    sheetId: '1gi_foSEziQ48hTlq8hBqIwZCHz6hma1rYXr8qykBq6c',
    tabs: {
      unreleased: t('698378858', 'unreleased', '🎼 Unreleased'),
      released: t('1140820289', 'released'),
      // the sheet's Recent tab has no links at all — derive it from Unreleased
      recent: t('698378858', 'recent-from-unreleased', '🎼 Unreleased'),
      stems: t('904073745', 'stems'),
    },
  },
  earlgold: {
    sheetId: '1EKEnvdiwSudiPJSePPzfCXIQ_W-AYeAIY6_r-a12bdM',
    tabs: {
      unreleased: t('793972257', 'unreleased'),
      recent: t('793972257', 'recent-from-unreleased'),
      stems: t('792344123', 'stems'),
    },
  },
  olivertreegold: {
    sheetId: '1rhvQ9F8VRAj-jOyTLsvhORsVCyvcMRXJuGoDR1-z4jY',
    tabs: {
      unreleased: t('1170668970', 'unreleased'),
      released: t('1382861902', 'released'),
      recent: t('255916635', 'unreleased'),
      'album-copies': t('948907906', 'passthrough'),
      stems: t('1709399582', 'stems'),
      art: t('1142970586', 'passthrough'),
      misc: t('208312506', 'passthrough'),
      fakes: t('1753918871', 'fakes'),
    },
  },
  fiviogold: {
    sheetId: '1K8WDS6pL7uOPvf7j78Om5kO1k0-h-beqMZaXpMAUy74',
    tabs: {
      unreleased: t('0', 'unreleased'),
      released: t('183311099', 'released'),
      recent: t('274220167', 'unreleased'),
      fakes: t('515726586', 'fakes'),
    },
  },
};

// Per-tracker era-name fixes (same table as ERA_FIXES in the importer).
//   headers: era-header Name cell (whitespace-collapsed) -> new Name cell
//   songs:   song-row Era -> era name
const ERA_FIXES: Record<string, { headers?: Record<string, string>; songs?: Record<string, string> }> = {
  clipsegold: {
    songs: { 'King Push: The Prelude': 'King Push – Darkest Before Dawn: The Prelude' },
  },
  delasoulgold: {
    headers: {
      'Art Official Itelligence: Mosiac Thump': 'AOI: Mosaic Thump',
      'Art Official Intelligence: Bionix': 'AOI: Bionix',
      'Art Official Intelligence: 3 [V1]': 'AOI: 3 [V1]',
      'Art Official Intelligence: 3 [V2]': 'AOI: 3 [V2]',
      'Maseo & Bumpy Knuckles Present... 4 Exits Only': '4 Exits Only\n(Maseo & Bumpy Knuckles)',
    },
    songs: { 'AOI: Mosiac Thump': 'AOI: Mosaic Thump', 'Your Welcome!': "You're Welcome!" },
  },
  olivertreegold: {
    // the sheet titles one header block for three album eras; give it to the first
    headers: { 'Cowboy Tears Drown the World in a Swimming Pool of Sorrow': 'Cowboy Tears' },
    songs: {
      'Soul Album': 'Untitled Soul Album',
      'Tommy Cash Collaboration': 'Unknown EP',
      'LYM, HYB': 'Love You Madly, Hate You Badly',
    },
  },
};

export function hasImportedSource(artist: string, tab: string): boolean {
  return !!IMPORTED_SOURCES[artist]?.tabs[tab];
}

// ------------------------------------------------------------------ helpers --
type Row = string[];
type Idx = number | null;

const clean = (s: string | undefined): string => (s ?? '').trim();
const firstLine = (c: string): string => clean(c).split('\n')[0].trim().toLowerCase();

function findHeader(rows: Row[]): number {
  const keys = new Set(['name', 'title', 'main content', 'full content']);
  const i = rows.findIndex(r => r.some(c => keys.has(firstLine(c))));
  return i < 0 ? 0 : i;
}

// First column whose header contains every keyword and no exclude. Callers chain
// alternatives with `||`, which (like the importer's Python `or`) skips index 0.
function col(h: Row, keywords: string[], exclude: string[] = []): Idx {
  for (let i = 0; i < h.length; i++) {
    const hl = clean(h[i]).toLowerCase();
    if (keywords.every(k => hl.includes(k)) && !exclude.some(x => hl.includes(x))) return i;
  }
  return null;
}

const cell = (r: Row, i: Idx): string => (i === null || i >= r.length ? '' : clean(r[i]));

const isCountHeader = (c: string): boolean =>
  (c ?? '').includes('\n') && /\b(Full|Tagged|Partial|OG|Snippet|Unavailable)\b/i.test(c);

function isCountBlock(c: string): boolean {
  const lines = (c ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(l =>
    /^\d+\s+(Total|Full|Tagged|Partial|OG|Snippets?|Unavailable|Confirmed|Leaks?|Beats?|Stems?|Cut|Lost|Rumou?red|Available|Instrumentals?|Demos?)\b/i.test(l));
}

// The file-count cell of an era-header row, always returned with a newline
// (a.ts keys era headers on a multi-line Era cell).
function eraHeaderCell(r: Row): string | null {
  if (!r.length) return null;
  let c: string | undefined;
  if (isCountHeader(r[0]) || isCountBlock(r[0])) c = r[0];
  else if (!clean(r[0])) c = r.slice(1).find(isCountBlock);
  if (c === undefined) return null;
  return c.trim().includes('\n') ? c : c.trim() + '\n';
}

function eraKey(s: string): string {
  const v = (s ?? '').split('\n')[0].replace(/\s+/g, ' ').trim().replace(/\*+$/, '').trim();
  return v.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- transforms --
const UNREL_HEADER = ['Era', 'Name', 'Notes', 'Track Length', 'File Date',
  'Leak Date', 'Available Length', 'Quality', 'Link(s)'];

function reconcileEras(out: Row[], nameRows: [number, string, string][]): Row[] {
  const hdr = new Map<string, string>();
  for (const r of out) {
    if (r[0].includes('\n')) {
      const name = clean(r[1].split('\n')[0]);
      const k = eraKey(name);
      if (!hdr.has(k)) hdr.set(k, name);
    }
  }
  const songKeys = new Set(out.filter(r => !r[0].includes('\n')).map(r => eraKey(r[0])));
  // count-less era headers: blank Era, title in Name, no file data
  const promoted: [number, Row][] = [];
  for (const [idx, title, notes] of nameRows) {
    const first = title.split('\n')[0];
    const rest = title.includes('\n') ? title.slice(title.indexOf('\n') + 1) : '';
    const k = eraKey(first.replace(/\(.*?\)/g, ''));
    if (k && !hdr.has(k) && songKeys.has(k)) {
      const name = clean(first.replace(/\(.*?\)/g, ''));
      const extra = [first.startsWith(name) ? clean(first.slice(name.length)) : '', clean(rest)]
        .filter(Boolean).join('\n');
      hdr.set(k, name);
      promoted.push([idx, ['\n', name + (extra ? '\n' + extra : ''), notes, '', '', '', '', '', '']]);
    }
  }
  for (const [idx, row] of promoted.reverse()) out.splice(idx, 0, row);
  for (const r of out) {
    if (r[0].includes('\n')) continue;
    const k = eraKey(r[0]);
    const exact = hdr.get(k);
    if (exact !== undefined) { r[0] = exact; continue; }
    const cands = [...hdr.entries()].filter(([hk]) => k && hk.startsWith(k)).map(([, v]) => v);
    r[0] = cands.length === 1 ? cands[0] : collapse(r[0]).replace(/\*+$/, '').trim();
  }
  // a.ts (re)initialises an era at its header row, dropping songs listed above
  // it — so move any header that trails its era's first song up to that song.
  for (let i = 0; i < out.length; i++) {
    const r = out[i];
    if (!r[0].includes('\n')) continue;
    const name = clean(r[1].split('\n')[0]);
    const first = out.findIndex((x, j) => j < i && !x[0].includes('\n') && x[0] === name);
    if (first >= 0) out.splice(first, 0, ...out.splice(i, 1));
  }
  return out;
}

function buildUnreleased(rows: Row[], artist: string): Row[] {
  const hi = findHeader(rows);
  const h = rows[hi] ?? [];
  const nameI = col(h, ['name']) || col(h, ['title']) || 1; // some sheets leave Name blank
  let notesI = col(h, ['note']) || col(h, ['info']) || col(h, ['description']);
  if (notesI === null && nameI + 1 < h.length && !clean(h[nameI + 1])) notesI = nameI + 1;
  const lcols = h.map((x, i) => (clean(x).toLowerCase().includes('link') ? i : -1)).filter(i => i >= 0);
  const ci = {
    name: nameI,
    notes: notesI,
    tlen: col(h, ['track', 'length']) || col(h, ['length'], ['available', 'full']),
    file: col(h, ['file', 'date']) || col(h, ['obtained']),
    leak: col(h, ['leak', 'date']),
    avail: col(h, ['available']) || col(h, ['portion']) || col(h, ['availability']),
    qual: col(h, ['quality']),
    link: col(h, ['link']) || col(h, ['source']),
  };
  const out: Row[] = [];
  const nameRows: [number, string, string][] = [];
  for (const r of rows.slice(hi + 1)) {
    if (r.length && !clean(r[0]) && cell(r, ci.name) && !eraHeaderCell(r)
        && ![ci.link, ci.avail, ci.qual, ci.tlen].some(i => cell(r, i))) {
      nameRows.push([out.length, cell(r, ci.name), cell(r, ci.notes)]);
      continue;
    }
    const hdrCell = eraHeaderCell(r);
    if (hdrCell) {
      const eraName = cell(r, ci.name); // a.ts: first line = era, rest = extra
      if (!eraName) continue;
      out.push([hdrCell, eraName, cell(r, ci.notes), '', '', '', '', '', '']);
    } else {
      const era = r.length ? collapse(r[0]) : '';
      const name = cell(r, ci.name);
      if (!era || !name) continue;
      const links = lcols.length > 1
        ? lcols.map(i => cell(r, i)).filter(Boolean).join('\n')
        : cell(r, ci.link);
      out.push([era, name, cell(r, ci.notes), cell(r, ci.tlen), cell(r, ci.file),
        cell(r, ci.leak), cell(r, ci.avail), cell(r, ci.qual), links]);
    }
  }
  const fixes = ERA_FIXES[artist] ?? {};
  for (const r of out) {
    if (r[0].includes('\n')) {
      const key = collapse(r[1]);
      if (fixes.headers?.[key] !== undefined) r[1] = fixes.headers[key];
    } else if (fixes.songs?.[r[0]] !== undefined) {
      r[0] = fixes.songs[r[0]];
    }
  }
  return reconcileEras(out, nameRows);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseDate(s: string): number | null {
  let m = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/.exec(s ?? '');
  if (m && MONTHS.includes(m[1].toLowerCase())) {
    return Number(m[3]) * 10000 + (MONTHS.indexOf(m[1].toLowerCase()) + 1) * 100 + Number(m[2]);
  }
  m = /\b(\d{4})\b/.exec(s ?? '');
  return m ? Number(m[1]) * 10000 : null;
}

function buildRecentFromUnreleased(unrel: Row[]): Row[] {
  return unrel
    .filter(r => !isCountHeader(r[0]))
    .map(r => [parseDate(r[5]), r] as const)
    .filter((x): x is readonly [number, Row] => x[0] !== null)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 60)
    .map(([, r]) => r);
}

const RELEASED_VALID = new Set(['Feature', 'Production', 'Single', 'Album Track',
  'Mixtape Track', 'EP Track', 'Other']);

function buildReleased(rows: Row[]): Row[] {
  const hi = findHeader(rows);
  const h = rows[hi] ?? [];
  const ci = {
    name: col(h, ['name']) || col(h, ['title']),
    notes: col(h, ['note']) || col(h, ['info']),
    tlen: col(h, ['length']),
    date: col(h, ['date']),
    type: col(h, ['type']),
    stream: col(h, ['stream']),
    link: col(h, ['link']) || col(h, ['source']),
  };
  const out: Row[] = [['Era', 'Name', 'Notes', 'Length', 'Release Date', 'Type', 'Streaming', 'Link(s)']];
  for (const r of rows.slice(hi + 1)) {
    const era0 = r[0] ?? '';
    if (isCountHeader(era0)) {
      const eraName = cell(r, ci.name).split('\n')[0];
      if (eraName) out.push([era0, eraName, '', '', '', '', '', '']);
      continue;
    }
    const era = clean(era0);
    const name = cell(r, ci.name);
    if (!era || !name) continue;
    let type = cell(r, ci.type);
    if (type === 'Track') type = 'Album Track';
    if (!RELEASED_VALID.has(type)) type = 'Other';
    out.push([era, name, cell(r, ci.notes), cell(r, ci.tlen), cell(r, ci.date), type,
      cell(r, ci.stream), cell(r, ci.link)]);
  }
  return out;
}

function buildStems(rows: Row[]): Row[] {
  const hi = findHeader(rows);
  const h = rows[hi] ?? [];
  const ci = {
    name: col(h, ['name']) || col(h, ['title']),
    notes: col(h, ['note']) || col(h, ['info']),
    file: col(h, ['file', 'date']),
    leak: col(h, ['leak', 'date']),
    full: col(h, ['full', 'length']) || col(h, ['length'], ['available']),
    bpm: col(h, ['bpm']),
    avail: col(h, ['available']) || col(h, ['portion']),
    qual: col(h, ['quality']),
    link: col(h, ['link']) || col(h, ['source']),
  };
  const out: Row[] = [['Era', 'Name', 'Notes', 'File Date', 'Leak Date',
    'Full Length', 'BPM', 'Available Length', 'Quality', 'Link(s)']];
  for (const r of rows.slice(hi + 1)) {
    const name = cell(r, ci.name);
    if (!name) continue;
    const avail = cell(r, ci.avail), qual = cell(r, ci.qual), link = cell(r, ci.link);
    if (!avail && !qual && !link) continue;
    out.push([clean(r[0]), name, cell(r, ci.notes), cell(r, ci.file), cell(r, ci.leak),
      cell(r, ci.full), cell(r, ci.bpm), avail, qual, link]);
  }
  return out;
}

function buildFakes(rows: Row[]): Row[] {
  const hi = findHeader(rows);
  const h = rows[hi] ?? [];
  const ci = {
    name: col(h, ['name']) || col(h, ['title']),
    notes: col(h, ['note']) || col(h, ['info']),
    made: col(h, ['made']) || col(h, ['designer']) || col(h, ['by']),
    type: col(h, ['type']),
    avail: col(h, ['available']) || col(h, ['portion']),
    qual: col(h, ['quality']),
    link: col(h, ['link']) || col(h, ['source']),
  };
  const out: Row[] = [['Era', 'Name', 'Notes', 'Made By', 'Type', 'Currently Available', 'Link(s)']];
  for (const r of rows.slice(hi + 1)) {
    const name = cell(r, ci.name);
    if (!name) continue;
    const avail = [cell(r, ci.avail), cell(r, ci.qual)].filter(Boolean).join(' ');
    out.push([clean(r[0]), name, cell(r, ci.notes), cell(r, ci.made), cell(r, ci.type),
      avail, cell(r, ci.link)]);
  }
  return out;
}

// Raw sheet rows -> the canonical CSV text the committed snapshot holds.
export function normalizeImportedTab(artist: string, kind: Kind, rows: Row[]): string {
  let out: Row[];
  switch (kind) {
    case 'unreleased': out = [UNREL_HEADER, ...buildUnreleased(rows, artist)]; break;
    case 'recent-from-unreleased':
      out = [UNREL_HEADER, ...buildRecentFromUnreleased(buildUnreleased(rows, artist))]; break;
    case 'released': out = buildReleased(rows); break;
    case 'stems': out = buildStems(rows); break;
    case 'fakes': out = buildFakes(rows); break;
    default: out = rows.filter(r => r.some(c => clean(c))); // art/misc/music videos/album copies
  }
  return joinCSVRows(out) + '\n';
}

// ------------------------------------------------------------- raw fetching --
interface ApiCell {
  formattedValue?: string;
  hyperlink?: string;
  textFormatRuns?: { format?: { link?: { uri?: string } } }[];
}

const LINK_HEADER = /link|source|snippet|url|download/i;
const LINK_LABELS = new Set(['link', 'links', 'here', 'snippet', 'pillows', 'pixeldrain', 'download']);

// Sheets API grid -> raw rows, with hyperlink hrefs swapped in for link cells
// whose text is only a label ("Link") — the CSV export loses those hrefs.
async function fetchApiRows(sheetId: string, title: string, apiKey: string): Promise<Row[] | null> {
  const fields = 'sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns.format.link.uri)';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    `?includeGridData=true&ranges=${encodeURIComponent(`'${title.replace(/'/g, "''")}'`)}` +
    `&fields=${encodeURIComponent(fields)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const doc = await res.json() as { sheets?: { data?: { rowData?: { values?: ApiCell[] }[] }[] }[] };
  const grid = (doc.sheets?.[0]?.data?.[0]?.rowData ?? []).map(r => r.values ?? []);
  if (!grid.length) return null;
  const texts = grid.map(r => r.map(c => c?.formattedValue ?? ''));
  const hdr = texts.find(r => r.some(c => /^\s*(link|source)/i.test(c))) ?? [];
  return grid.map((r, ri) => r.map((c, i) => {
    const text = texts[ri][i];
    const hrefs: string[] = [];
    if (c?.hyperlink) hrefs.push(c.hyperlink);
    for (const run of c?.textFormatRuns ?? []) {
      const u = run.format?.link?.uri;
      if (u && !hrefs.includes(u)) hrefs.push(u);
    }
    if (!hrefs.length || text.includes('http')) return text;
    if (LINK_HEADER.test(hdr[i] ?? '') || !text.trim() || LINK_LABELS.has(text.trim().toLowerCase())) {
      return hrefs.join('\n');
    }
    return text;
  }));
}

async function fetchExportRows(sheetId: string, gid: string): Promise<Row[] | null> {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return null;
  const text = await res.text();
  if (text.trimStart().startsWith('<')) return null; // HTML sign-in / error page
  return splitCSVRows(text);
}

// Fetch + normalize one tab live. Throws a short reason on failure so the
// caller can report it (admin health) before falling back to the snapshot.
export async function fetchImportedCsv(artist: string, tab: string, apiKey: string | undefined): Promise<string> {
  const src = IMPORTED_SOURCES[artist];
  const spec = src?.tabs[tab];
  if (!src || !spec) throw new Error('no imported source');
  let rows: Row[] | null;
  if (spec.via === 'api') {
    if (!apiKey) throw new Error('GOOGLE_SHEETS_API_KEY not set');
    rows = await fetchApiRows(src.sheetId, spec.title!, apiKey);
    if (!rows) throw new Error('Sheets API request failed');
  } else {
    rows = await fetchExportRows(src.sheetId, spec.gid);
    if (!rows) throw new Error('Sheet export failed (private, or gid gone?)');
  }
  const csv = normalizeImportedTab(artist, spec.kind, rows);
  // A structural change in the sheet that leaves (almost) nothing parseable
  // shouldn't blank the tracker — serve the snapshot instead.
  if (splitCSVRows(csv).length < 2) throw new Error('normalized tab is empty');
  return csv;
}
