/**
 * build-jojigold-csvs.mjs
 * Patches the Link(s) column in public/jojigold/data/*.csv with the real hyperlink
 * URLs extracted from the live Joji Tracker spreadsheet. The public gviz/CSV export
 * only contains a hyperlink's display text (e.g. "Snippet", "Link"), never the
 * href — that's why the committed CSVs had junk in Link(s) and playback crashed.
 *
 * Run scripts/fetch-sheet-links.mjs first to produce jojigold-links.csv:
 *   GOOGLE_API_KEY=... node scripts/fetch-sheet-links.mjs \
 *     --sheet 1FPlWbXnx94y5FODJ2qniLf0BzViNSAmj6Xdfw1ZNwQ4 \
 *     --out ~/Downloads/jojigold-links.csv \
 *     --gids 990933532,108045339,583378522,1199844386,1821222349,1271385780,1419046321,2027576133,1461221709
 *
 * Usage: node scripts/build-jojigold-csvs.mjs
 *   Optional env: JOJIGOLD_LINKS_CSV=/path/to/jojigold-links.csv (default: ~/Downloads/jojigold-links.csv)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const TABS = [
  { name: 'unreleased',   file: 'unreleased.csv' },
  { name: 'recent',       file: 'recent.csv' },
  { name: 'released',     file: 'released.csv' },
  { name: 'stems',        file: 'stems.csv' },
  { name: 'art',          file: 'art.csv' },
  { name: 'misc',         file: 'misc.csv' },
  { name: 'music-videos', file: 'music-videos.csv' },
  { name: 'tracklists',   file: 'tracklists.csv' },
  { name: 'fakes',        file: 'fakes.csv' },
];

const LINKS_CSV = process.env.JOJIGOLD_LINKS_CSV
  || join(homedir(), 'Downloads', 'jojigold-links.csv');

const DATA_DIR = new URL('../public/jojigold/data/', import.meta.url).pathname;

// CSV parser — handles quoted fields with embedded newlines/commas/quotes
function parseCSV(text) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { field += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\n') { cur.push(field); field = ''; rows.push(cur); cur = []; }
      else if (ch !== '\r') { field += ch; }
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

const toCSVRow = (fields) => fields.map(s => '"' + String(s ?? '').replace(/"/g, '""') + '"').join(',');
const normEra = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const normName = (s) => s.split('\n')[0].toLowerCase().replace(/\s+/g, ' ').trim();

function loadLinksCSV(path) {
  if (!existsSync(path)) {
    console.error(`Links CSV not found: ${path}`);
    console.error('Run scripts/fetch-sheet-links.mjs first, or set JOJIGOLD_LINKS_CSV.');
    process.exit(1);
  }
  const rows = parseCSV(readFileSync(path, 'utf8')).filter(r => r.length > 1);
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const tabIdx = headers.indexOf('tab');
  const eraIdx = headers.indexOf('era');
  const nameIdx = headers.indexOf('name');
  const urlIdx = headers.indexOf('url');

  const index = new Map();
  for (const row of rows.slice(1)) {
    const tab = (row[tabIdx] || '').trim().toLowerCase();
    const url = (row[urlIdx] || '').trim();
    if (!tab || !url) continue;
    const key = normEra(row[eraIdx] || '') + '\x00' + normName(row[nameIdx] || '');
    if (!index.has(tab)) index.set(tab, new Map());
    const tabMap = index.get(tab);
    if (!tabMap.has(key)) tabMap.set(key, []);
    if (!tabMap.get(key).includes(url)) tabMap.get(key).push(url);
  }
  return index;
}

function main() {
  console.log(`Loading links from: ${LINKS_CSV}`);
  const linksIndex = loadLinksCSV(LINKS_CSV);
  for (const [tab, m] of linksIndex) {
    console.log(`  ${tab}: ${m.size} songs (${[...m.values()].reduce((a, b) => a + b.length, 0)} URLs)`);
  }

  for (const tabDef of TABS) {
    const path = join(DATA_DIR, tabDef.file);
    if (!existsSync(path)) { console.log(`\nSkipping ${tabDef.file} (not found)`); continue; }

    const rows = parseCSV(readFileSync(path, 'utf8')).filter(r => r.length > 1);
    const headers = rows[0];
    const eraIdx = headers.findIndex(h => h.trim().toLowerCase() === 'era');
    const nameIdx = headers.findIndex(h => ['name', 'title'].includes(h.trim().toLowerCase()));
    const linkIdx = headers.findIndex(h => /^link/i.test(h.trim()));
    if (eraIdx < 0 || nameIdx < 0 || linkIdx < 0) {
      console.log(`\nSkipping ${tabDef.file}: couldn't find era/name/link columns`);
      continue;
    }

    const tabLinks = linksIndex.get(tabDef.name) || new Map();
    let patched = 0, total = 0;
    const outRows = [headers];
    for (const row of rows.slice(1)) {
      const era = row[eraIdx] || '', rawName = row[nameIdx] || '';
      if (!era.trim() || !rawName.trim()) { outRows.push(row); continue; }
      total++;
      const urls = tabLinks.get(normEra(era) + '\x00' + normName(rawName)) || [];
      if (urls.length) { row[linkIdx] = urls.join('\n'); patched++; }
      outRows.push(row);
    }

    writeFileSync(path, outRows.map(toCSVRow).join('\n') + '\n', 'utf8');
    console.log(`\n${tabDef.file}: patched ${patched}/${total} rows with real links`);
  }

  console.log('\nDone! Review public/jojigold/data/ diffs, then commit.');
}

main();
