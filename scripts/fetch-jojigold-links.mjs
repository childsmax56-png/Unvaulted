/**
 * fetch-jojigold-links.mjs
 * One-off extractor for the Joji Tracker spreadsheet: every tab uses column 0
 * for Era and column 1 for the track/title (labeled "Track" or "Title"
 * depending on tab), which the generic scripts/fetch-sheet-links.mjs header
 * heuristics don't recognize (and "Recent" has a Discord-banner row above its
 * real header, offsetting everything by one row). This locates the header row
 * per-tab by finding the "Link(s)"/"Links" header cell, then reads era (col 0)
 * and name (col 1) directly, matching build-jojigold-csvs.mjs's expected
 * Tab,Era,Name,URL shape.
 *
 * Usage: GOOGLE_API_KEY=... node scripts/fetch-jojigold-links.mjs --out /tmp/jojigold-links.csv
 */

import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = '1FPlWbXnx94y5FODJ2qniLf0BzViNSAmj6Xdfw1ZNwQ4';
const OUT = arg('out', join(homedir(), 'Downloads', 'jojigold-links.csv'));

if (!API_KEY) {
  console.error('Missing GOOGLE_API_KEY / GOOGLE_SHEETS_API_KEY.');
  process.exit(1);
}

const TABS = [
  { slug: 'unreleased',   gid: '990933532' },
  { slug: 'released',     gid: '108045339' },
  { slug: 'recent',       gid: '583378522' },
  { slug: 'misc',         gid: '1199844386' },
  { slug: 'stems',        gid: '1821222349' },
  { slug: 'music-videos', gid: '1271385780' },
  { slug: 'art',          gid: '1419046321' },
  { slug: 'tracklists',   gid: '2027576133' },
  { slug: 'fakes',        gid: '1461221709' },
];

const toCSVRow = (fields) =>
  fields.map(s => '"' + String(s ?? '').replace(/"/g, '""') + '"').join(',');

function cellLinks(cell) {
  if (!cell) return [];
  const urls = [];
  if (cell.hyperlink) urls.push(cell.hyperlink);
  for (const run of cell.textFormatRuns || []) {
    const uri = run.format && run.format.link && run.format.link.uri;
    if (uri) urls.push(uri);
  }
  return [...new Set(urls)];
}

const cellText = (cell) =>
  (cell && (cell.formattedValue ?? (cell.effectiveValue && cell.effectiveValue.stringValue))) || '';

async function main() {
  const fields = [
    'sheets.properties(sheetId,title)',
    'sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns)',
  ].join(',');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
    `?includeGridData=true&fields=${encodeURIComponent(fields)}&key=${API_KEY}`;

  console.log(`Fetching ${SHEET_ID} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 500)}`);
    process.exit(1);
  }
  const doc = await res.json();

  const out = [['Tab', 'Era', 'Name', 'URL']];
  let totalLinks = 0;

  for (const { slug, gid } of TABS) {
    const sheet = doc.sheets.find(s => String(s.properties.sheetId) === gid);
    if (!sheet) { console.log(`  ${slug.padEnd(14)} (gid ${gid}): tab not found`); continue; }
    const grid = (sheet.data && sheet.data[0] && sheet.data[0].rowData) || [];

    // Find the header row: the first row containing a "Link(s)"/"Links" cell.
    let headerRow = -1;
    for (let i = 0; i < Math.min(grid.length, 5); i++) {
      const cells = grid[i].values || [];
      if (cells.some(c => /^links?(\(s\))?$/i.test(cellText(c).trim()))) { headerRow = i; break; }
    }
    if (headerRow < 0) { console.log(`  ${slug.padEnd(14)} (gid ${gid}): header row not found, skipping`); continue; }

    let sheetLinks = 0;
    let curEra = '';
    for (const row of grid.slice(headerRow + 1)) {
      const cells = row.values || [];
      const eraCell = cellText(cells[0]).trim();
      if (eraCell) curEra = eraCell;
      const name = cellText(cells[1]).trim();
      if (!name) continue; // era-divider rows have no track name

      for (const cell of cells) {
        for (const link of cellLinks(cell)) {
          out.push([slug, curEra, name, link]);
          sheetLinks++; totalLinks++;
        }
      }
    }
    console.log(`  ${slug.padEnd(14)} (gid ${gid}, header row ${headerRow}): ${sheetLinks} links`);
  }

  writeFileSync(OUT, out.map(toCSVRow).join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${totalLinks} links -> ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
