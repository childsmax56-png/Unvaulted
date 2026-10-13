/**
 * build-sheet-tabs.mjs
 *
 * Enumerates a tracker's Google Sheet tabs (name → gid) from the sheet's public
 * /htmlview and prints a paste-ready SHEET_SOURCES entry for
 * functions/api/[artist]/_sheets.ts, mapping sheet tab names to the tracker's
 * file-slug tabs (unreleased, released, art, stems, ...).
 *
 * It does NOT edit _sheets.ts — enabling a tracker for live sync flips its tabs from
 * the committed CSV snapshot to the live sheet, which can regress links for trackers
 * that merge links from a separate source into their committed CSV. Add an entry only
 * after confirming the live export preserves working links (see the note in _sheets.ts).
 *
 * Usage:
 *   node scripts/build-sheet-tabs.mjs                 # all artists with a sheet id
 *   node scripts/build-sheet-tabs.mjs yzygold pushagold
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTISTS_DIR = join(__dirname, '..', 'src', 'artists');

// File-slug → candidate sheet tab names (normalized: lowercased, emoji/punct/[wip] stripped).
const SLUG_ALIASES = {
  unreleased: ['unreleased'],
  released: ['released'],
  recent: ['recent'],
  art: ['art'],
  stems: ['stems'],
  misc: ['misc'],
  fakes: ['fakes'],
  'music-videos': ['music videos', 'musicvideos', 'videos'],
  'album-copies': ['album copies', 'albumcopies', 'copies'],
  tracklists: ['tracklists', 'tracklist'],
};

// Normalize a sheet tab name for matching: lowercase, drop emoji/punctuation and
// trailing qualifiers like "[WIP]", "- WIP", "(WIP)".
function norm(name) {
  return name
    .replace(/\\x[0-9a-f]{2}/gi, ' ') // unescape leftover \x.. sequences from htmlview
    .replace(/\\\//g, '/')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:wip|v\d+)\)/g, ' ')
    .replace(/-\s*wip\b/g, ' ')
    .replace(/\bwip\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract [{ gid, name }] from a sheet's htmlview HTML.
function parseTabs(html) {
  const out = [];
  const re = /gid=(\d+)", gid: "(\d+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const gid = m[2];
    const before = html.slice(Math.max(0, m.index - 400), m.index);
    const names = [...before.matchAll(/name:\s*"([^"]*)"/g)];
    const name = names.length ? names[names.length - 1][1] : '';
    out.push({ gid, name });
  }
  return out;
}

async function fetchHtmlview(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`htmlview HTTP ${res.status}`);
  return res.text();
}

function readArtistSheetIds() {
  const files = readdirSync(ARTISTS_DIR).filter((f) => f.endsWith('.ts') && f !== 'types.ts' && f !== 'index.ts' && f !== 'activeConfig.ts');
  const map = {};
  for (const f of files) {
    const src = readFileSync(join(ARTISTS_DIR, f), 'utf8');
    const slug = src.match(/slug:\s*'([^']+)'/)?.[1] ?? f.replace(/\.ts$/, '');
    const id = src.match(/HARDCODED_SHEET_ID:\s*'([^']*)'/)?.[1] ?? '';
    if (id) map[slug] = id;
  }
  return map;
}

async function run() {
  const filter = process.argv.slice(2);
  const all = readArtistSheetIds();
  const slugs = filter.length ? filter : Object.keys(all);

  for (const slug of slugs) {
    const sheetId = all[slug];
    if (!sheetId) {
      console.log(`\n// ${slug}: no HARDCODED_SHEET_ID — skipped`);
      continue;
    }
    let tabs;
    try {
      tabs = parseTabs(await fetchHtmlview(sheetId));
    } catch (e) {
      console.log(`\n// ${slug}: failed to read sheet (${e.message})`);
      continue;
    }

    const gids = {};
    const usedGids = new Set();
    for (const [tabSlug, aliases] of Object.entries(SLUG_ALIASES)) {
      const hit = tabs.find((t) => aliases.includes(norm(t.name)) && !usedGids.has(t.gid));
      if (hit) {
        gids[tabSlug] = hit.gid;
        usedGids.add(hit.gid);
      }
    }

    const entryGids = Object.entries(gids)
      .map(([k, v]) => `      ${/-/.test(k) ? `'${k}'` : k}: '${v}',`)
      .join('\n');
    console.log(`\n  ${slug}: {`);
    console.log(`    sheetId: '${sheetId}',`);
    console.log(`    gids: {\n${entryGids}\n    },`);
    console.log(`  },`);

    const matched = new Set(Object.keys(gids));
    const missing = Object.keys(SLUG_ALIASES).filter((s) => !matched.has(s));
    if (missing.length) console.log(`  // ${slug} unmatched tabs (fall back to committed CSV): ${missing.join(', ')}`);
    console.log(`  // ${slug} all sheet tabs: ${tabs.map((t) => `${norm(t.name) || '?'}=${t.gid}`).join(', ')}`);
  }
}

run();
