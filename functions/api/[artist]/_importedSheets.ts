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

type Kind = 'unreleased' | 'recent' | 'released' | 'stems' | 'fakes' | 'passthrough' | 'recent-from-unreleased';

interface RawTab {
  gid: string;
  // 'api': read the grid via the Sheets API (export 401s, or links are
  // display-text-only hyperlinks the CSV export drops). Needs `title`.
  via?: 'api';
  title?: string;
}

interface ImportedTab extends RawTab {
  kind: Kind;
  // Group trackers (Migos): the members' Recent tabs, interleaved with the
  // group's by leak date.
  members?: (RawTab & { member: string })[];
}

interface ImportedSource {
  sheetId: string;
  tabs: Record<string, ImportedTab>;
}

const t = (gid: string, kind: Kind, api?: string): ImportedTab =>
  api ? { gid, kind, via: 'api', title: api } : { gid, kind };

const m = (member: string, gid: string): RawTab & { member: string } => ({ gid, member });

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
      released: t('1202104579', 'released'), // the sheet's "Off-Streaming" tab
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
  jpegmafiagold: {
    sheetId: '1IhfNqEOtwczA6JH52gv2feerMqlJEbaDV4bxaIr7gkI',
    tabs: {
      unreleased: t('2012820373', 'unreleased'),
      released: t('1767027991', 'released'),
      recent: t('823823047', 'unreleased'),
      stems: t('2044022564', 'stems'),
      'album-copies': t('1359718971', 'passthrough'),
      'music-videos': t('448180846', 'passthrough'),
      misc: t('207906054', 'passthrough'),
    },
  },
  migosgold: {
    sheetId: '1MgVRlGs5DL7keB_I6YPEj4FYLOHb8DVJbxN5-h6yxOE',
    tabs: {
      unreleased: t('335484962', 'unreleased'),
      // each member's tab is its own tracker tab (config memberTabs)
      'member-quavo': t('1266312566', 'unreleased'),
      'member-offset': t('1395330475', 'unreleased'),
      'member-takeoff': t('911547308', 'unreleased'),
      recent: { ...t('711581406', 'recent'),
        members: [m('Quavo', '844278669'), m('Offset', '1455811060'), m('Takeoff', '1370426296')] },
    },
  },
  nbayoungboygold: {
    sheetId: '1-eJxsD-YciRGsQ6367NQ8zKdVJKEq8pirJPcwncgSwg',
    tabs: {
      unreleased: t('0', 'unreleased', 'Unreleased'),
      // the sheet's RECENTS tab has no links — derive it from Unreleased
      recent: t('0', 'recent-from-unreleased', 'Unreleased'),
      released: t('1306638127', 'released', 'Released *WIP*'),
      'music-videos': t('1849981206', 'passthrough', 'Unreleased Music Videos/Vlogs/Interviews'),
    },
  },
  vincegold: {
    sheetId: '1_NjFkevi7tbhqAGHSfgaEsKrzRgvPePUeCLv0GG2GgU',
    tabs: {
      unreleased: t('306146520', 'unreleased'),
      // no Recent tab on the sheet — derive it from Unreleased
      recent: t('306146520', 'recent-from-unreleased'),
      released: t('776106700', 'released'),
      stems: t('441477856', 'stems'),
    },
  },
  xzibitgold: {
    sheetId: '1EVBoDCk8uZ5ft1wRpTsqJlHxfdYDnFVbbD5bRMR6qpw',
    tabs: {
      unreleased: t('1520634709', 'unreleased'),
      released: t('197122594', 'released'),
      recent: t('2048130339', 'unreleased'),
      stems: t('1630804638', 'stems'),
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
const ERA_FIXES: Record<string, {
  headers?: Record<string, string>;
  songs?: Record<string, string>;
  preferSongEra?: boolean;
}> = {
  // headers wrap mid-title ("38 Baby 2 [V1] / Ain't Too"): name eras after the
  // songs' cleaner Era cells and keep the header title as the subtitle
  nbayoungboygold: {
    preferSongEra: true,
    songs: { '4444t': '4444', 'Just Got A Lot On My Shoulders': 'I Just Got A Lot On My Shoulders' },
  },
  migosgold: { songs: { 'Collab with Rich The Kid': 'Collaboration with Rich The Kid' } },
  // a.ts's global ERA_NAME_MAP already renames the full title to "Darkest Before Dawn"
  clipsegold: {
    headers: {
      'King Push – Darkest Before Dawn: The Prelude (by Pusha T)':
        'Darkest Before Dawn\n(King Push – Darkest Before Dawn: The Prelude) (by Pusha T)',
    },
    songs: { 'King Push: The Prelude': 'Darkest Before Dawn' },
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

// Drop invisible marks and filler lines some sheets pad cells with
// (NBA YoungBoy: 'Mind of a Menace Era\n(1999 - June 2016)\n\n.\n.', 'AHLAN \u200e').
function tidyCell(c: string): string {
  c = c.replace(/[\u200b\u200e\u200f\ufeff]/g, '');
  if (c.includes('\n') || c.trim() === '.' || c.trim() === '|') {
    c = c.split('\n').filter(l => l.trim() !== '.' && l.trim() !== '|').join('\n');
  }
  return c;
}

function findHeader(rows: Row[]): number {
  const keys = new Set(['name', 'title', 'main content', 'full content']);
  // any line of the cell — some sheets pad headers with blank lines (' \nName\n')
  const i = rows.findIndex(r => r.some(c => c.split('\n').some(l => keys.has(l.trim().toLowerCase()))));
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

// Per-era stats banner ('23 Total\n1 Single\n...', '16 Album Tracks') that some
// tabs put in the Era column above each era's rows.
const STAT_WORD = /^\d+\s+(Total|Full|Tagged|Partial|OG|Snippets?|Unavailable|Confirmed|Leaks?|Singles?|Album|Features?|Productions?|Remix(es)?|Mixtapes?|EP|Others?|Music|OST|Intros?|Interludes?|Skits?|Bonus|Never|Beats?|Stems?|Demos?|Instrumentals?|Covers?|Freestyles?)\b/i;

function isStatBlock(c: string): boolean {
  const lines = (c ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const counted = lines.map(l => /^\d+\s+\S/.test(l));
  if (!lines.length || !counted[0]) return false;
  if (lines.length === 1) return STAT_WORD.test(lines[0]);
  // tolerate a wrapped line or two ('9 "MOAM3 Reloaded"\nSongs')
  return counted.filter(Boolean).length / lines.length >= 0.6;
}

// 'TOP ⭐' -> 'TOP': drop decorative emoji (and a dangling ' /') ending an era
// header's first line.
function stripTrailingEmoji(name: string): string {
  const nl = name.indexOf('\n');
  const first = nl < 0 ? name : name.slice(0, nl);
  const rest = nl < 0 ? '' : name.slice(nl);
  return first.replace(/[\s/\u2600-\u27bf\u2b00-\u2bff\u{1f300}-\u{1faff}\ufe0f]+$/u, '') + rest;
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

function reconcileEras(out: Row[], nameRows: [number, string, string][], preferSongEra = false): Row[] {
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
    // exact title first ("Father Of 4 (Deluxe)"), else with parentheticals dropped
    const raw = eraKey(first);
    const k = songKeys.has(raw) ? raw : eraKey(first.replace(/\(.*?\)/g, ''));
    if (k && !hdr.has(k) && songKeys.has(k)) {
      const name = k === raw ? clean(first) : clean(first.replace(/\(.*?\)/g, ''));
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
    r[0] = cands.length === 1 && !preferSongEra ? cands[0] : collapse(r[0]).replace(/\*+$/, '').trim();
  }
  // Headers whose name matches no song era (NBA YoungBoy: header 'Mind of a
  // Menace Era' over songs filed as 'Pre 38 Baby') take the era of the songs
  // directly below them, when no other header claims it; the sheet's header
  // title is kept as the era's subtitle.
  const names = new Set(out.filter(r => r[0].includes('\n')).map(r => clean(r[1].split('\n')[0])));
  const songEraSet = new Set(out.filter(r => !r[0].includes('\n')).map(r => r[0]));
  for (let i = 0; i < out.length; i++) {
    const r = out[i];
    if (!r[0].includes('\n') || songEraSet.has(clean(r[1].split('\n')[0]))) continue;
    const nxt = out[i + 1];
    if (nxt && !nxt[0].includes('\n') && !names.has(nxt[0])) {
      const old = clean(r[1]).replace(/\s*\n\s*/g, ' ').trim();
      r[1] = nxt[0] + '\n(' + old + ')';
      names.add(nxt[0]);
    }
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
  // drop header rows of eras with no (named) songs — they'd render as empty eras
  const songEras = new Set(out.filter(r => !r[0].includes('\n')).map(r => r[0]));
  return out.filter(r => !r[0].includes('\n') || songEras.has(clean(r[1].split('\n')[0])));
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
    const selfTitled = r.length > 0 && !!clean(r[0]) && eraKey(r[0]) === eraKey(cell(r, ci.name));
    // (an era description may sit in the Portion column — long prose isn't an availability)
    if (r.length && (!clean(r[0]) || selfTitled) && cell(r, ci.name) && !eraHeaderCell(r)
        && ![ci.link, ci.qual, ci.tlen].some(i => cell(r, i))
        && (!cell(r, ci.avail) || cell(r, ci.avail).length > 25)) {
      nameRows.push([out.length, cell(r, ci.name), cell(r, ci.notes)]);
      continue;
    }
    const hdrCell = eraHeaderCell(r);
    if (hdrCell) {
      const eraName = stripTrailingEmoji(cell(r, ci.name)); // a.ts: first line = era, rest = extra
      if (!eraName) continue;
      out.push([hdrCell, eraName, cell(r, ci.notes), '', '', '', '', '', '']);
    } else {
      const era = r.length ? collapse(r[0]) : '';
      const name = cell(r, ci.name);
      if (!era || !name) continue;
      const links = lcols.length > 1
        ? lcols.map(i => cell(r, i)).filter(Boolean).join('\n')
        : cell(r, ci.link);
      const song = [era, name, cell(r, ci.notes), cell(r, ci.tlen), cell(r, ci.file),
        cell(r, ci.leak), cell(r, ci.avail), cell(r, ci.qual), links];
      if (!song.slice(2).some(Boolean)) continue; // sub-section label ('2018 Sessions'), not a song
      out.push(song);
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
  return reconcileEras(out, nameRows, !!fixes.preferSongEra);
}

// Recent tabs are flat, newest-first lists: interleave the group's and each
// member's by leak date (undated rows last, in tab order).
function mergeRecentTabs(blocks: [string | null, Row[]][]): Row[] {
  const rows: Row[] = [];
  for (const [member, block] of blocks) {
    for (const r0 of block) {
      if (r0[0].includes('\n')) continue;
      const r = [...r0];
      if (member) r[1] = r[1] + '\n(' + member + ')';
      rows.push(r);
    }
  }
  return rows.map(r => [parseDate(r[5]) ?? 0, r] as const).sort((a, b) => b[0] - a[0]).map(([, r]) => r);
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
const RELEASED_TYPE_ALIASES: Record<string, string> = {
  Track: 'Album Track', Singles: 'Single', Features: 'Feature', 'Album Tracks': 'Album Track',
  Mixtape: 'Mixtape Track', 'Mixtape Tracks': 'Mixtape Track', 'EP Tracks': 'EP Track',
  Productions: 'Production', Album: 'Album Track', EP: 'EP Track', Song: 'Album Track', Songs: 'Album Track',
};

// Sheet Type -> a released.ts type. Compound labels keep their first part
// ('Feature / Single' -> Feature); anything unknown (Remix, OST Track...) -> Other.
function releasedType(raw: string): string {
  const t = collapse(clean(raw));
  for (let part of [t, t.split('/')[0].trim()]) {
    part = RELEASED_TYPE_ALIASES[part] ?? part;
    if (RELEASED_VALID.has(part)) return part;
  }
  // descriptive labels (NBA YoungBoy: 'Lead Project Single', 'Compilation Project')
  if (/\bsingle\b/i.test(t)) return 'Single';
  if (/\bproject\b/i.test(t) && !/skit/i.test(t)) return 'Album Track';
  return 'Other';
}

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
  // some sheets split links across columns ('Download(s)' + 'Original Link(s)')
  const lcols = h.map((x, i) => (/link|download/i.test(clean(x)) ? i : -1)).filter(i => i >= 0);
  const out: Row[] = [['Era', 'Name', 'Notes', 'Length', 'Release Date', 'Type', 'Streaming', 'Link(s)']];
  for (const r of rows.slice(hi + 1)) {
    const era0 = r[0] ?? '';
    if (isCountHeader(era0)) {
      const eraName = cell(r, ci.name).split('\n')[0];
      if (eraName) out.push([era0, eraName, '', '', '', '', '', '']);
      continue;
    }
    if (isStatBlock(era0)) continue;
    const era = collapse(era0);
    const name = cell(r, ci.name);
    if (!era || !name) continue;
    const links = lcols.length > 1 ? lcols.map(i => cell(r, i)).filter(Boolean).join('\n') : cell(r, ci.link);
    out.push([era, name, cell(r, ci.notes), cell(r, ci.tlen), cell(r, ci.date), releasedType(cell(r, ci.type)),
      cell(r, ci.stream), links]);
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
// Art / Misc / Music Videos / Album Copies: drop empty and stats rows. When
// links are split into a second 'Original Link(s)' column, fold them into the
// first Link(s) column — that's the one the views read.
function buildPassthrough(rows: Row[]): Row[] {
  rows = rows.filter(r => r.some(c => clean(c)) && !(r.length && isStatBlock(r[0])));
  if (!rows.length) return rows;
  const hi = findHeader(rows);
  const lcols = rows[hi].map((x, i) => (clean(x).toLowerCase().includes('link') ? i : -1)).filter(i => i >= 0);
  if (lcols.length > 1 && lcols.slice(1).some(i => rows[hi][i].toLowerCase().includes('original'))) {
    const first = lcols[0];
    for (const r of rows.slice(hi + 1)) {
      const vals = lcols.filter(i => i < r.length && clean(r[i])).map(i => clean(r[i]));
      if (first < r.length) r[first] = [...new Set(vals)].join('\n');
    }
  }
  return rows;
}

// Raw sheet rows (plus any member tabs' rows) -> the canonical CSV text the
// committed snapshot holds.
export function normalizeImportedTab(artist: string, kind: Kind, rows: Row[],
  members: [string, Row[]][] = []): string {
  rows = rows.map(r => r.map(tidyCell));
  members = members.map(([mb, rs]) => [mb, rs.map(r => r.map(tidyCell))]);
  let out: Row[];
  switch (kind) {
    case 'unreleased':
    case 'recent': {
      let built = buildUnreleased(rows, artist);
      if (members.length) {
        built = mergeRecentTabs([[null, built],
          ...members.map(([mb, rs]) => [mb, buildUnreleased(rs, artist)] as [string, Row[]])]);
      }
      out = [UNREL_HEADER, ...built];
      break;
    }
    case 'recent-from-unreleased':
      out = [UNREL_HEADER, ...buildRecentFromUnreleased(buildUnreleased(rows, artist))]; break;
    case 'released': out = buildReleased(rows); break;
    case 'stems': out = buildStems(rows); break;
    case 'fakes': out = buildFakes(rows); break;
    default: // art/misc/music videos/album copies
      out = buildPassthrough(rows);
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
  const fetchRaw = async (raw: RawTab): Promise<Row[]> => {
    if (raw.via === 'api') {
      if (!apiKey) throw new Error('GOOGLE_SHEETS_API_KEY not set');
      const rows = await fetchApiRows(src.sheetId, raw.title!, apiKey);
      if (!rows) throw new Error('Sheets API request failed');
      return rows;
    }
    const rows = await fetchExportRows(src.sheetId, raw.gid);
    if (!rows) throw new Error('Sheet export failed (private, or gid gone?)');
    return rows;
  };
  // all-or-nothing: a missing member tab would silently drop that member's songs
  const [rows, ...memberRows] = await Promise.all([spec, ...(spec.members ?? [])].map(fetchRaw));
  const members = (spec.members ?? []).map((mb, i) => [mb.member, memberRows[i]] as [string, Row[]]);
  const csv = normalizeImportedTab(artist, spec.kind, rows, members);
  // A structural change in the sheet that leaves (almost) nothing parseable
  // shouldn't blank the tracker — serve the snapshot instead.
  if (splitCSVRows(csv).length < 2) throw new Error('normalized tab is empty');
  return csv;
}
