// Live Tracklists tab: the { legend, albums } JSON the Tracklists view reads,
// built at request time from the sheet's Tracklists tab instead of the
// committed public/<slug>/Tracklists.json snapshot.
//
// This is a port of scripts/build-tracklists-enriched.py's build_from_rows
// (generic sheets) and scripts/build-travisgold-csvs.py's
// build_tracklists_htmlview (travisgold), reading the tab through its htmlview
// (_sheetGrid.ts) so it works on download-disabled sheets without an API key.
// Keep them in step with those scripts.
//
// The committed Tracklists.json stays the fallback: the endpoint serves it when
// the sheet can't be read or yields no albums. Floating (non in-cell) images
// only exist in the snapshot, so they're carried over from it by album match.

import { fetchSheetGrid, type GridCell, type GridRow } from './_sheetGrid';

// slug → [spreadsheet id, Tracklists tab gid]
export const TRACKLIST_SHEETS: Record<string, [string, string]> = {
  aapgold: ['1rbt_VyQyHEfVRv_XmVBNrwMyF0uMx7FF-1T8-N0wf0E', '1024624532'],
  antclemonsgold: ['11Ta0gixhRv9uUq-_O9nID_rjUf3oembw57f2sblMP3k', '1372270223'],
  badbunnygold: ['1O5RFNuOF4-K7xWCYMRQXy3Y_WkYOWu6o9zClsw8lPi4', '2035478417'],
  cactigold: ['1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo', '1956640286'],
  clipsegold: ['1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ', '1717251426'],
  coldplaygold: ['1i4xfiqtONMps_FL9n_2O5UmpKKio6HUCh5y6zQniyPk', '1999300901'],
  colegold: ['1hjMtB-acUEpXYkR6TWQVeVoUzSLrAVIdy1lMoM6aFFw', '1282750024'],
  d4vdgold: ['1N6_EyCC6AM_cpFkIJivCN0kWzEwJRev7vQCmFAChnjk', '745709653'],
  deathgripsgold: ['1Eh-9UyWUtyEpi_ELEhq5pD41ivFJHuQcvz2wFR2ml9g', '1999300901'],
  dmxgold: ['101y0kCIzwGoT0YmGHIchehUpO7tzAdjXSZZVRrEobOg', '1443132755'],
  doechiigold: ['1P2inSuDEuS_kp45qDAXJpb_hmj__Lj409bytyp4xiw8', '1038033313'],
  dongold: ['1qsO4SuzzB17d5orqbKWHsaQsRdk0lzTSF9rV2FwQf-Q', '1236129964'],
  dregold: ['10_QK8xP-WCdrfO6RaIkhdDtYUXaM966e6D1xWD__iIo', '1717251426'],
  drizzygold: ['1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI', '230473404'],
  dualipagold: ['1gi_foSEziQ48hTlq8hBqIwZCHz6hma1rYXr8qykBq6c', '1490490572'],
  earlgold: ['1EKEnvdiwSudiPJSePPzfCXIQ_W-AYeAIY6_r-a12bdM', '544570411'],
  fiftygold: ['1UBHQ067bIEDH3TapHIt3MCdwDNRe30Qv0VdBP9JLgFM', '1717251426'],
  futuregold: ['1alPlu5jpMv5-HbyKkBX-gH5SC4QPZH90StbAaUA9o0k', '1309224685'],
  gambinogold: ['1eyBjj7qPxIT_P93RaSPZf5hTJemGi5jMqSJF777OsdE', '1016050461'],
  gorillazgold: ['1jauTeMKDULPud0hGD-gPeD-HM70HiBSedrLyOyAqUh0', '710536063'],
  gunnagold: ['1P_BA-CIy05lDl9j1H06awxNqvXYJcD-KeBPVdgTO7Eo', '1476869338'],
  icecubegold: ['1bsNrVejh4H27uafX6jpnllbAuiVqRnDUMegKdTYAFQA', '1369615792'],
  jayzgold: ['18GwItf2M92QimNMAbUCfFsxCkiHlkf8DPJPLWHAcoxQ', '1236871730'],
  jojigold: ['1FPlWbXnx94y5FODJ2qniLf0BzViNSAmj6Xdfw1ZNwQ4', '2027576133'],
  jpegmafiagold: ['1IhfNqEOtwczA6JH52gv2feerMqlJEbaDV4bxaIr7gkI', '961600266'],
  juicegold: ['1tD3ytt5wPx4zfcefXi5ATeYhIiDaugWjMS46nZrP568', '1999300901'],
  kdotgold: ['1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI', '1043194158'],
  keemgold: ['1_SNZQS-AAXVleukgKlraegaozkLOu8WMHbUwmPm61hc', '489341454'],
  kengold: ['1OARID98xCqRaBr8gyQCvI3aD4jKQDGgtedyRaiP_pyo', '372423620'],
  lonelygold: ['1J16EyxHqZD4m0VZ6g6SoY_1GC21TU7P2kk9FeteSKvE', '654868102'],
  macgold: ['17TycQCSpIm-6DyWId4ve8fVaM7Ewg3lgV1DDNRwauh0', '179600863'],
  migosgold: ['1MgVRlGs5DL7keB_I6YPEj4FYLOHb8DVJbxN5-h6yxOE', '88562067'],
  mjgold: ['1i59TKrIZ1OvFFPJFuOMw1VXlvyzaVOH0Wb0vVJp9BTw', '608188924'],
  nasgold: ['1-UZb9y-GQB5v3sysdUlYBxfUKDu58_Cw-TqUd8-v4U4', '1717251426'],
  olivertreegold: ['1rhvQ9F8VRAj-jOyTLsvhORsVCyvcMRXJuGoDR1-z4jY', '215165047'],
  premiergold: ['1RaAzCb3IAg0FZas9dsAMqU785xw1sDYIvx3-SVFEVsY', '18222096'],
  shadygold: ['1x9tTOOqH5WpKOoptdQzABSN_x8oZbMgzIGlGH9w1IKA', '1443132755'],
  slimegold: ['12zc2reK5y8XP6SQhv1ujQtiG9VpJy7yDWwDuE-S-wpc', '1999300901'],
  smokegold: ['1-Kd8molYeR1WpmWR81DqmSCGng3g-AVmZfgd752kh3M', '1999300901'],
  sosagold: ['1oDE9gTnEG7ufPQIOMjLTegfI47qtgNCxngmxxHZL4qA', '1885470461'],
  stevelacygold: ['1xqnIw0wymufIjKfoaXGDC-KAVuF81S5quMCCX7lYQyc', '1251519406'],
  szagold: ['1mPq6ZvoQ1_kWqIH9JS8I2VbBb8WboFYyeMP2yqjtz7s', '1999300901'],
  travisgold: ['18Ht_QECCPW3zPkuBmGeJDTRMjFEinRlWyAtbkBivjPo', '1372270223'],
  trippiegold: ['1hZdGFBZmukWGH4IlnH0NJvphwEct2XEMJT_moTFhTvc', '1800483758'],
  twizzygold: ['1FUzAZyTCgFTVxQ--qbCAS2bUk4dsAw6ASxwjURPHbyI', '602198332'],
  tydollagold: ['11Kk3Mi8iiFmXEFV8vzcmTrnjcMkfgImABCavXhC4D48', '813585500'],
  uzigold: ['1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo', '1983561937'],
  vampgold: ['1Irtfvymu26CShYowLMMfD-rM0o9CJqE6-BBSlYsAaF4', '1038033313'],
  weekndgold: ['1luU-KL_vKt72goUpSO2F0qMvXyqaT_q8VwYNjPeLgTg', '337423375'],
  wolfgold: ['19GJTNp7PxK1OtyVBmGelZSMm5i8Fy82EGtcFdIkBpsY', '660032103'],
  wutanggold: ['1dA2h1kQffOmUUeCy6YMu8IYdGGqnhnWuabKdK7emyyU', '1817611336'],
  xgold: ['1vMEIba05N8zD2iSh_knAkAMzyrm9rtreu1NJeyNZj0I', '666785613'],
  yecomgold: ['1JcJOHsNdCo7rBS6dbOUbBGjeq_CS8x0FqdW9_cnTozs', '1372270223'],
  yegold: ['1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y', '1372270223'],
  yelolgold: ['1wQ0WC0U9q10fLWpy9CO8YR128eE8msGXqtZI8_cNyTA', '1372270223'],
  yzygold: ['12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM', '1372270223'],
};

// Sheets that keep each tracklist as a coloured numbered list inside the row's
// Notes cell (scripts/build-travisgold-csvs.py's htmlview builder).
const NOTES_CELL_TRACKLISTS = new Set(['travisgold']);

export interface LegendItem { label: string; color: string }
export interface Track { num: string; name: string; color?: string; colorLabel?: string }
export interface Album {
  era: string;
  name: string;
  date: string;
  quality: string;
  source: string;
  links: string[];
  description?: string;
  tracks: Track[];
  availability?: string;
  availColor?: string;
  availLabel?: string;
  images?: string[];
}
export interface Tracklists { legend: LegendItem[]; albums: Album[] }

export const hasLiveTracklists = (artist: string): boolean => artist in TRACKLIST_SHEETS;

// ── shared helpers (build-tracklists-enriched.py) ─────────────────────────────

const rgb = (hx: string): [number, number, number] | null => {
  const h = hx.replace(/^#/, '').slice(-6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

function matchLegend(color: string | null, legend: Record<string, string>, tol = 40): string | null {
  if (!color) return null;
  const keys = Object.keys(legend);
  if (!keys.length) return null;
  const hx = '#' + color.replace(/^#/, '').slice(-6).toLowerCase();
  if (hx in legend) return hx;
  const c = rgb(hx);
  if (!c) return null;
  let best: string | null = null;
  let bestD = tol + 1;
  for (const key of keys) {
    const l = rgb(key);
    if (!l) continue;
    const d = Math.max(Math.abs(c[0] - l[0]), Math.abs(c[1] - l[1]), Math.abs(c[2] - l[2]));
    if (d < bestD) { best = key; bestD = d; }
  }
  return best;
}

function lineLegendColor(chars: [string, string | null][] | undefined, start: number, legend: Record<string, string>): string | null {
  if (!chars || !Object.keys(legend).length) return null;
  const votes = new Map<string, number>();
  for (const [ch, color] of chars.slice(start)) {
    if (!ch.trim() || !color) continue;
    const key = matchLegend(color, legend);
    if (key) votes.set(key, (votes.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of votes) if (v > n) { best = k; n = v; }
  return best;
}

const TRACK_RE = /^\s*#?(\d+|\?)[.)]\s+(.*\S)\s*$/;
const TRACK_RE_D = /^\s*#?(\d+|\?)[.)]\s+(.*\S)\s*$/d;

function splitTracklist(text: string, runs: GridCell['runs'], legend: Record<string, string>): [string, Track[]] {
  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n');
  const lineChars = new Map<number, [string, string | null][]>();
  if (runs) {
    let idx = 0;
    for (const [seg, color] of runs) {
      for (const ch of seg) {
        if (ch === '\n') { idx++; continue; }
        if (!lineChars.has(idx)) lineChars.set(idx, []);
        lineChars.get(idx)!.push([ch, color]);
      }
    }
  }
  const desc: string[] = [];
  const tracks: Track[] = [];
  let seen = false;
  lines.forEach((line, i) => {
    const m = TRACK_RE_D.exec(line);
    if (m) {
      seen = true;
      const entry: Track = { num: m[1] === '?' ? '#?' : '#' + m[1], name: m[2].trim() };
      // Colour vote over the title's characters only (the "1. " prefix is usually plain).
      const start = [...line.slice(0, m.indices![2][0])].length;
      const hx = lineLegendColor(lineChars.get(i), start, legend);
      if (hx) { entry.color = hx; entry.colorLabel = legend[hx]; }
      tracks.push(entry);
    } else if (!seen) {
      desc.push(line);
    }
  });
  return [desc.join('\n').trim(), tracks];
}

const looksLikeTracklist = (s: string): boolean =>
  !!s && s.split('\n').filter(l => TRACK_RE.test(l)).length >= 2;

function findCol(header: Map<number, GridCell>, ...keys: string[]): number | null {
  for (const [col, cell] of header) {
    const low = (cell.text || '').toLowerCase();
    if (keys.some(k => low.includes(k))) return col;
  }
  return null;
}

function parseLegend(cells: Map<number, GridCell>): LegendItem[] {
  for (const cell of cells.values()) {
    const val = cell.text;
    if (!cell.runs || !val || !val.includes('|')) continue;
    if (!/available|unheard/i.test(val)) continue;
    const out: LegendItem[] = [];
    for (const [seg, color] of cell.runs) {
      const label = seg.trim().replace(/^\|+|\|+$/g, '').trim();
      if (label && color && label !== '|') out.push({ label, color: '#' + color.replace(/^#/, '').slice(-6) });
    }
    if (out.length) return out;
  }
  return [];
}

function parseLinks(val: string): string[] {
  const out: string[] = [];
  for (const u of (val || '').match(/https?:\/\/\S+/g) ?? []) {
    const url = u.replace(/[).,;]+$/, '');
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

function excelDate(val: string): string {
  if (!val) return '';
  const f = Number(val);
  if (val.trim() && !Number.isNaN(f) && f > 20000 && f < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.trunc(f) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return val.trim();
}

function excelText(val: string): string {
  if (!val) return '';
  const f = Number(val);
  if (!val.trim() || Number.isNaN(f)) return val.trim();
  if (f >= 0 && f < 1) {
    const total = Math.round(f * 24 * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  return val.trim();
}

const EMPTY: GridCell = { text: '', fill: null, color: null, runs: null, links: [], hasImage: false };

// ── generic sheets (build_from_rows) ──────────────────────────────────────────

export function buildFromGrid(rows: GridRow[], imagesByRow: Map<number, string[]>): Tracklists {
  // Header = first of the top rows with a tracklist-ish and name/era-ish label
  // (short labels only, so prose rows mentioning "name" don't count).
  let headerIdx = 0;
  let found = false;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const vals = [...rows[i].cells.values()].map(c => c.text.trim());
    if (vals.some(v => v.length > 40)) continue;
    const joined = vals.join(' ').toLowerCase();
    if (joined.includes('tracklist') && (joined.includes('name') || joined.includes('era'))) {
      headerIdx = i;
      found = true;
      break;
    }
  }
  const header = found ? rows[headerIdx].cells : new Map<number, GridCell>();
  const cEra = findCol(header, 'era') ?? 0;
  let cName = findCol(header, 'name', 'title');
  const cTl = findCol(header, 'tracklist') ?? 2;
  if (cName === null && !found) cName = 1;
  if (cName === null || cName === cTl) cName = null;
  const cDate = findCol(header, 'date');
  const cAvail = findCol(header, 'availab');
  const cQual = findCol(header, 'quality');
  const cSource = findCol(header, 'source');
  const cLink = findCol(header, 'link');

  let legend: LegendItem[] = [];
  let legendColors: Record<string, string> = {};
  for (const r of rows.slice(0, headerIdx + 2)) {
    legend = parseLegend(r.cells).length ? parseLegend(r.cells) : legend;
    if (legend.length) {
      legendColors = Object.fromEntries(legend.map(l => [l.color.toLowerCase(), l.label]));
      break;
    }
  }

  const get = (cells: Map<number, GridCell>, c: number | null): GridCell => (c === null ? EMPTY : cells.get(c) ?? EMPTY);
  const albums: Album[] = [];
  for (const { n, cells } of rows.slice(headerIdx + 1)) {
    const rawName = cName !== null ? excelText(get(cells, cName).text) : '';
    const tlCell = get(cells, cTl);
    const era = excelText(get(cells, cEra).text);
    const hasImg = imagesByRow.has(n);
    const [description, tracks] = splitTracklist(tlCell.text, tlCell.runs, legendColors);
    if (cName !== null && !rawName && !tracks.length && !hasImg) continue;
    let name = rawName;
    if (!name || looksLikeTracklist(name)) name = era;
    if (!name && !tlCell.text.trim()) continue;

    const date = cDate !== null ? excelDate(get(cells, cDate).text) : '';
    const availability = cAvail !== null ? get(cells, cAvail).text.trim() : '';
    const quality = cQual !== null ? get(cells, cQual).text.trim() : '';
    const source = cSource !== null ? get(cells, cSource).text.trim() : '';
    const links = cLink !== null ? parseLinks(get(cells, cLink).text) : [];
    // Real hyperlinks: the Link(s) column first, then any cell when it has none.
    const linkCells = [...cells.entries()].filter(([, c]) => c.links.length)
      .sort(([a], [b]) => Number(a !== cLink) - Number(b !== cLink));
    for (const [col, c] of linkCells) {
      if (col === cLink || !links.length) {
        for (const u of c.links) if (u.startsWith('http') && !links.includes(u)) links.push(u);
      }
    }

    let availColor = '';
    let availLabel = '';
    if (Object.keys(legendColors).length) {
      for (const c of cells.values()) {
        const key = matchLegend(c.fill, legendColors, 12);
        if (key) { availColor = key.toUpperCase(); availLabel = legendColors[key]; break; }
      }
    }

    const entry: Album = {
      era: era || name,
      name: name || era,
      date,
      quality: quality || source,
      source,
      links,
      description,
      tracks,
    };
    if (availability) entry.availability = availability;
    if (availColor) { entry.availColor = availColor; entry.availLabel = availLabel; }
    if (hasImg) entry.images = imagesByRow.get(n);
    albums.push(entry);
  }
  return { legend, albums };
}

// ── travisgold: tracklists inside the Notes cell ──────────────────────────────

const NOTES_TRACK_LINE = /^(#?\d+|#?\?+)[.)]\s*(.+)$/;

function buildFromNotesCells(rows: GridRow[], imagesByRow: Map<number, string[]>): Tracklists {
  const legend: LegendItem[] = [];
  const albums: Album[] = [];
  let headerSeen = false;
  for (const { n, cells } of rows) {
    const text = (c: number) => (cells.get(c)?.text ?? '').trim();
    if (!headerSeen) {
      headerSeen = text(0) === 'Era' && text(1) === 'Name';
      continue;
    }
    // The legend is a single colspan cell under the header.
    if (cells.size === 1 && cells.has(0) && !text(1)) {
      const only = cells.get(0)!;
      if (!legend.length && only.runs) {
        for (const [seg, color] of only.runs) {
          const label = seg.trim();
          if (label && label !== '|' && color) legend.push({ label, color });
        }
      }
      continue;
    }
    if (!text(1)) continue;
    const legendByColor = Object.fromEntries(legend.map(l => [l.color, l.label]));
    const tracks: Track[] = [];
    const before: string[] = [];
    const after: string[] = [];
    // Split the Notes cell into lines, each coloured by its first visible character.
    const notes = cells.get(2) ?? EMPTY;
    const lines: [string, string | null][] = [];
    let cur = '';
    let curColor: string | null = null;
    for (const [seg, color] of notes.runs ?? [[notes.text, notes.color] as [string, string | null]]) {
      for (const ch of seg) {
        if (ch === '\n') { lines.push([cur, curColor]); cur = ''; curColor = null; continue; }
        if (!cur.trim() && ch.trim()) curColor = color;
        cur += ch;
      }
    }
    lines.push([cur, curColor]);
    for (const [raw, color] of lines) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(NOTES_TRACK_LINE);
      if (m) {
        const num = m[1].replace(/^#/, '');
        const t: Track = { num: '#' + (/^\d+$/.test(num) ? String(parseInt(num, 10)) : '?'), name: m[2].trim() };
        if (color && legendByColor[color]) { t.color = color; t.colorLabel = legendByColor[color]; }
        tracks.push(t);
      } else {
        (tracks.length ? after : before).push(line);
      }
    }
    const linkCell = cells.get(7) ?? EMPTY;
    const links = [...new Set([...linkCell.links, ...(linkCell.text.match(/https?:\/\/\S+/g) ?? [])])];
    const desc = [...before, ...after].join(' ').trim();
    const album: Album = {
      era: text(0), name: text(1), date: text(4), quality: text(5), source: text(6), links, tracks,
    };
    if (desc) album.description = desc;
    const images = imagesByRow.get(n);
    if (images?.length) album.images = images;
    albums.push(album);
  }
  return { legend, albums };
}

// ── images carried over from the committed snapshot (carry_images) ───────────

const albumSig = (a: Album): [Set<string>, string] => [
  new Set((a.tracks ?? []).map(t => t.name.toLowerCase())),
  (a.description ?? '').trim().toLowerCase().slice(0, 200),
];

export function carryImages(old: Album[], albums: Album[]): void {
  const taken = new Set<number>();
  for (const o of old) {
    if (!o.images?.length) continue;
    const [oTracks, oDesc] = albumSig(o);
    let best: number | null = null;
    let bestScore = 0;
    albums.forEach((a, i) => {
      if (taken.has(i) || a.era !== o.era) return;
      const [tracks, desc] = albumSig(a);
      const union = new Set([...oTracks, ...tracks]);
      let score = union.size ? [...oTracks].filter(t => tracks.has(t)).length / union.size : 0;
      if (desc && desc === oDesc) score += 1;
      if (a.name === o.name) score += 0.25;
      if (score > bestScore) { best = i; bestScore = score; }
    });
    if (best !== null && bestScore >= 0.5) {
      taken.add(best);
      if (!albums[best].images?.length) albums[best].images = o.images;
    }
  }
}

// A tracklist cell that is one big hyperlink renders in the htmlview with the
// cell's colour instead of its rich-text colours, so its tracks come out
// uncoloured. Take those tracks' colours from the snapshot when the same album
// has the same track there (and the colour is still in the legend).
export function carryTrackColors(old: Album[], result: Tracklists): void {
  const legend = new Set(result.legend.map(l => l.color.toLowerCase()));
  const byAlbum = new Map(old.map(a => [`${a.era}\u0001${a.name}`, a]));
  for (const a of result.albums) {
    if (!a.tracks.some(t => !t.color)) continue;
    const prev = byAlbum.get(`${a.era}\u0001${a.name}`);
    if (!prev) continue;
    const colors = new Map((prev.tracks ?? []).filter(t => t.color).map(t => [t.name, t]));
    for (const t of a.tracks) {
      const p = colors.get(t.name);
      if (!t.color && p?.color && legend.has(p.color.toLowerCase())) {
        t.color = p.color;
        if (p.colorLabel) t.colorLabel = p.colorLabel;
      }
    }
  }
}

// Build the live Tracklists JSON. `rowImages` resolves the tab's in-cell
// images (sheet row → image URLs) and is only called when the tab has any;
// `snapshot` is the committed Tracklists.json, for images the htmlview can't
// see. Throws when the sheet can't be read or yields no albums.
export async function buildLiveTracklists(
  artist: string,
  rowImages: (sheetId: string, gid: string) => Promise<Map<number, string[]>>,
  snapshot: () => Promise<Album[]>,
): Promise<Tracklists> {
  const src = TRACKLIST_SHEETS[artist];
  if (!src) throw new Error('no live Tracklists tab');
  const [sheetId, gid] = src;
  const grid = await fetchSheetGrid(sheetId, gid);
  const hasImages = grid.some(r => [...r.cells.values()].some(c => c.hasImage));
  const images = hasImages ? await rowImages(sheetId, gid).catch(() => new Map<number, string[]>()) : new Map<number, string[]>();
  const result = NOTES_CELL_TRACKLISTS.has(artist) ? buildFromNotesCells(grid, images) : buildFromGrid(grid, images);
  if (!result.albums.length) throw new Error('Tracklists tab had no albums');
  const old = await snapshot().catch(() => [] as Album[]);
  if (old.some(a => a.images?.length)) carryImages(old, result.albums);
  carryTrackColors(old, result);
  return result;
}
