/**
 * build-cactigold-csvs.mjs
 * Patches the Link(s)/Links column in public/cactigold/data/*.csv with real
 * URLs extracted from the live CACTIgold spreadsheet (the plain CSV/gviz
 * export only contains the display text of a hyperlink, e.g. "Pillowcase",
 * never the actual href — that's why links don't load).
 *
 * Produce cactigold-links.csv (Tab,Era,Name,URL) first, then run this script to
 * merge those URLs into the static CSVs. Two ways to produce it:
 *   - Automated (preferred): the Sheets API v4, no browser step —
 *       GOOGLE_API_KEY=... node scripts/fetch-sheet-links.mjs \
 *         --sheet 1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo \
 *         --out ~/Downloads/cactigold-links.csv
 *   - Manual (legacy): run scripts/extract-cactigold-links.gs in
 *       script.google.com, then download the result from your Google Drive.
 *
 * Usage: node scripts/build-cactigold-csvs.mjs
 *   Optional env: CACTIGOLD_LINKS_CSV=/path/to/cactigold-links.csv (default: ~/Downloads/cactigold-links.csv)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const TABS = [
  { name: 'unreleased', file: 'unreleased.csv' },
  { name: 'recent',     file: 'recent.csv' },
  { name: 'released',   file: 'released.csv' },
  { name: 'fakes',      file: 'fakes.csv' },
  { name: 'stems',      file: 'stems.csv' },
  { name: 'tracklists', file: 'tracklists.csv' },
];

const LINKS_CSV = process.env.CACTIGOLD_LINKS_CSV
  || join(homedir(), 'Downloads', 'cactigold-links.csv');

const DATA_DIR = new URL('../public/cactigold/data/', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded newlines/commas/quotes
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];
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

function toCSVRow(fields) {
  const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  return fields.map(q).join(',');
}

function normEra(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }
function normName(s) { return s.split('\n')[0].toLowerCase().replace(/\s+/g, ' ').trim(); }

// ---------------------------------------------------------------------------
// Load cactigold-links.csv → Map<tabName, Map<era+name, string[]>>
// ---------------------------------------------------------------------------
function loadLinksCSV(path) {
  if (!existsSync(path)) {
    console.error(`Links CSV not found: ${path}`);
    console.error('Run scripts/extract-cactigold-links.gs in script.google.com first, download the result, and point CACTIGOLD_LINKS_CSV at it.');
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
    const era = normEra(row[eraIdx] || '');
    const name = normName(row[nameIdx] || '');
    const url = (row[urlIdx] || '').trim();
    if (!tab || !name || !url) continue;
    if (!index.has(tab)) index.set(tab, new Map());
    const tabMap = index.get(tab);
    const key = era + '\x00' + name;
    if (!tabMap.has(key)) tabMap.set(key, []);
    if (!tabMap.get(key).includes(url)) tabMap.get(key).push(url);
  }
  return index;
}

function main() {
  console.log(`Loading links from: ${LINKS_CSV}`);
  const linksIndex = loadLinksCSV(LINKS_CSV);
  for (const [tab, m] of linksIndex) {
    console.log(`  ${tab}: ${m.size} songs with links (${[...m.values()].reduce((a, b) => a + b.length, 0)} URLs)`);
  }

  for (const tabDef of TABS) {
    const path = join(DATA_DIR, tabDef.file);
    if (!existsSync(path)) { console.log(`\nSkipping ${tabDef.file} (not found)`); continue; }

    const rows = parseCSV(readFileSync(path, 'utf8')).filter(r => r.length > 1);
    const headers = rows[0];
    const eraIdx = headers.findIndex(h => h.trim().toLowerCase() === 'era');
    const nameIdx = headers.findIndex(h => h.trim().toLowerCase() === 'name' || h.trim().toLowerCase() === 'title');
    const linkIdx = headers.findIndex(h => /^link/i.test(h.trim()));

    if (eraIdx < 0 || nameIdx < 0 || linkIdx < 0) {
      console.log(`\nSkipping ${tabDef.file}: couldn't find era/name/link columns`);
      continue;
    }

    const tabLinks = linksIndex.get(tabDef.name) || new Map();
    let patched = 0;
    let total = 0;

    const outRows = [headers];
    for (const row of rows.slice(1)) {
      const era = row[eraIdx] || '';
      const rawName = row[nameIdx] || '';
      if (!era.trim() || !rawName.trim()) { outRows.push(row); continue; }

      total++;
      const key = normEra(era) + '\x00' + normName(rawName);
      const urls = tabLinks.get(key) || [];
      if (urls.length) {
        row[linkIdx] = urls.join('\n');
        patched++;
      }
      outRows.push(row);
    }

    const csvContent = outRows.map(toCSVRow).join('\n') + '\n';
    writeFileSync(path, csvContent, 'utf8');
    console.log(`\n${tabDef.file}: patched ${patched}/${total} rows with real links`);
  }

  console.log('\nDone! Commit public/cactigold/data/ to deploy.');
}

main();
