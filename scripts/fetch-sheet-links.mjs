/**
 * fetch-sheet-links.mjs
 * Reads the REAL hyperlink URLs out of a public Google Sheet via the Sheets API
 * v4 and writes them to a CSV (Tab, Era, Name, URL) — the same shape the
 * extract-*-links.gs Apps Scripts produce, so the existing build-*-csvs.mjs
 * mergers can consume the output unchanged.
 *
 * WHY THIS EXISTS
 *   Sheets whose "download / print / copy" is disabled (Travis Scott, Ken Carson,
 *   etc.) block export?format=csv|xlsx, and every gviz export (csv/json/html) only
 *   returns a hyperlink's DISPLAY TEXT ("Pillowcase", "Pixeldrain") — never the
 *   href. The Sheets API's includeGridData response, in contrast, exposes both
 *   whole-cell links (cell.hyperlink) and partial rich-text links
 *   (textFormatRuns[].format.link.uri). It works on any "anyone with the link can
 *   view" sheet with only a free API key — no OAuth, no edit access, no manual
 *   browser step.
 *
 * ONE-TIME SETUP (free)
 *   1. https://console.cloud.google.com  ->  create/pick a project
 *   2. APIs & Services -> Enable "Google Sheets API"
 *   3. Credentials -> Create credentials -> API key  (copy it)
 *   (Optional but recommended: restrict the key to the Sheets API.)
 *
 * USAGE
 *   GOOGLE_API_KEY=AIza... node scripts/fetch-sheet-links.mjs \
 *     --sheet 1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo \
 *     --out ~/Downloads/travisgold-links.csv \
 *     [--gids 1807066929,123456]        # limit to specific tabs (default: all)
 *
 *   With no flags it defaults to the Travis Scott sheet used for the initial test.
 */

import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ---- args -----------------------------------------------------------------
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = arg('sheet', '1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo');
const OUT = arg('out', join(homedir(), 'Downloads', 'sheet-links.csv'));
const ONLY_GIDS = arg('gids', '')
  .split(',').map(s => s.trim()).filter(Boolean);

if (!API_KEY) {
  console.error('Missing GOOGLE_API_KEY. See the setup notes at the top of this file.');
  process.exit(1);
}

// ---- helpers --------------------------------------------------------------
const toCSVRow = (fields) =>
  fields.map(s => '"' + String(s ?? '').replace(/"/g, '""') + '"').join(',');

// Turn a tab title into the slug the tracker CSVs use (best-effort; adjust the
// mapping per tracker as needed).
function tabSlug(title) {
  const t = title.toLowerCase().trim();
  if (/unreleased/.test(t)) return 'unreleased';
  if (/^recent|updates?/.test(t)) return 'recent';
  if (/released|album/.test(t) && !/copies/.test(t)) return 'released';
  if (/stems/.test(t)) return 'stems';
  if (/art\b|cover/.test(t)) return 'art';
  if (/fake/.test(t)) return 'fakes';
  if (/video/.test(t)) return 'music-videos';
  if (/copies/.test(t)) return 'album-copies';
  if (/tracklist/.test(t)) return 'tracklists';
  if (/misc/.test(t)) return 'misc';
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Every URL carried by one cell: the whole-cell hyperlink plus any per-run links.
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

// ---- fetch ----------------------------------------------------------------
async function main() {
  const fields = [
    'properties.title',
    'sheets.properties(sheetId,title)',
    'sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns)',
  ].join(',');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
    `?includeGridData=true&fields=${encodeURIComponent(fields)}&key=${API_KEY}`;

  console.log(`Fetching ${SHEET_ID} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets API ${res.status}: ${body.slice(0, 500)}`);
    if (res.status === 403 && /SERVICE_DISABLED|has not been used/.test(body))
      console.error('\n-> Enable "Google Sheets API" for this key\'s project (see setup notes).');
    if (res.status === 403 && /PERMISSION_DENIED/.test(body))
      console.error('\n-> Make sure the sheet is shared "anyone with the link can view".');
    process.exit(1);
  }
  const doc = await res.json();
  console.log(`Workbook: "${doc.properties?.title || SHEET_ID}"`);

  const out = [['Tab', 'Era', 'Name', 'URL']];
  let totalLinks = 0;

  for (const sheet of doc.sheets || []) {
    const gid = String(sheet.properties.sheetId);
    if (ONLY_GIDS.length && !ONLY_GIDS.includes(gid)) continue;

    const slug = tabSlug(sheet.properties.title);
    const grid = (sheet.data && sheet.data[0] && sheet.data[0].rowData) || [];
    if (!grid.length) continue;

    // Locate era + name/title columns from the header row.
    const header = (grid[0].values || []).map(c => cellText(c).replace(/\n/g, ' ').trim().toLowerCase());
    const eraIdx = header.findIndex(h => h === 'era' || h.startsWith('era '));
    const nameIdx = header.findIndex(h => ['name', 'title'].includes(h) || h.startsWith('title '));

    let sheetLinks = 0;
    let curEra = '';
    for (const row of grid.slice(1)) {
      const cells = row.values || [];
      if (eraIdx >= 0 && cellText(cells[eraIdx]).trim()) curEra = cellText(cells[eraIdx]).trim();
      const name = nameIdx >= 0 ? cellText(cells[nameIdx]).trim() : '';

      for (const cell of cells) {
        for (const link of cellLinks(cell)) {
          out.push([slug, curEra, name || cellText(cell).trim(), link]);
          sheetLinks++; totalLinks++;
        }
      }
    }
    console.log(`  ${slug.padEnd(14)} (gid ${gid}): ${sheetLinks} links`);
  }

  writeFileSync(OUT, out.map(toCSVRow).join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${totalLinks} links -> ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
