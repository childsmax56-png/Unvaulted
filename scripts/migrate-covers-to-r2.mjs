// Migrate cover art / photos off the slow i.ibb.co free host onto our own R2
// bucket, so images load from a fast, same-origin origin instead of crawling
// (i.ibb.co has been serving a single 2.4 MB cover in 100+ seconds, which also
// makes Cloudflare's image transform time out with err=9504).
//
// What it does, resumably (safe to re-run — progress is kept in a manifest):
//   1. collect — scan src/ for every https://i.ibb.co/... URL.
//   2. upload  — download each, downscale to webp (gifs pass through unchanged
//                to preserve animation), and `wrangler r2 object put` it into
//                the yeditsgold-uploads bucket under covers/<hash>.<ext>.
//   3. rewrite — replace every old URL in the source with the new same-origin
//                URL: /api/yedits-file?key=covers/<hash>.<ext>
//
// The new URLs are served by the existing functions/api/yedits-file.ts route
// (same one avatars use), which streams any bucket key with its stored
// Content-Type — so no public bucket domain or extra function is needed.
//
// Auth: the upload step shells out to `wrangler r2 object put --remote`, which
// reads CLOUDFLARE_API_TOKEN (and, if the token spans multiple accounts,
// CLOUDFLARE_ACCOUNT_ID) from the environment. Never hard-code the token here.
//
// Usage:
//   node scripts/migrate-covers-to-r2.mjs collect
//   node scripts/migrate-covers-to-r2.mjs upload [--limit N]
//   node scripts/migrate-covers-to-r2.mjs rewrite
//   node scripts/migrate-covers-to-r2.mjs all         # collect + upload + rewrite
//   node scripts/migrate-covers-to-r2.mjs status      # (default) print progress

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const execFileP = promisify(execFile);
const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const WORK_DIR = path.join(ROOT, 'scripts', '.cover-migration');
const TMP_DIR = path.join(WORK_DIR, 'tmp');
const MANIFEST = path.join(WORK_DIR, 'manifest.json');

const HOST_RE = /https:\/\/i\.ibb\.co\/[A-Za-z0-9]+\/[^\s"'`)\\]+/g;
const BUCKET = 'yeditsgold-uploads';
const KEY_PREFIX = 'covers/';
const SERVE_BASE = '/api/yedits-file?key=';
const MAX_DIM = 1400;         // fullscreen player + tier list are the largest uses
const WEBP_QUALITY = 80;
const CONCURRENCY = 3;        // i.ibb.co is slow + flaky; keep it gentle
const DOWNLOAD_TIMEOUT_MS = 120_000;
const DOWNLOAD_RETRIES = 4;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// ---------------------------------------------------------------------------

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      await walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function loadManifest() {
  if (existsSync(MANIFEST)) return JSON.parse(await readFile(MANIFEST, 'utf8'));
  return { entries: {} };
}
let saveQueue = Promise.resolve();
function saveManifest(m) {
  // Serialize writes so concurrent workers don't clobber the file.
  saveQueue = saveQueue.then(() => writeFile(MANIFEST, JSON.stringify(m, null, 2)));
  return saveQueue;
}

function keyFor(url) {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const ext = /\.gif(\?|$)/i.test(url) ? 'gif' : 'webp';
  return `${KEY_PREFIX}${hash}.${ext}`;
}

async function collect(manifest) {
  const files = await walk(SRC_DIR);
  const found = new Set();
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    for (const m of text.matchAll(HOST_RE)) found.add(m[0]);
  }
  let added = 0;
  for (const url of found) {
    if (!manifest.entries[url]) {
      const key = keyFor(url);
      manifest.entries[url] = { key, newUrl: SERVE_BASE + key, status: 'pending' };
      added++;
    }
  }
  await saveManifest(manifest);
  console.log(`collect: ${found.size} unique URLs (${added} new), ${Object.keys(manifest.entries).length} total in manifest`);
}

async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://unvaulted.cc/' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (attempt < DOWNLOAD_RETRIES) {
        const backoff = 2000 * attempt;
        console.log(`  retry ${attempt}/${DOWNLOAD_RETRIES} after ${err.message} (wait ${backoff}ms)`);
        await new Promise(r => setTimeout(r, backoff));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function processOne(url, entry, manifest) {
  const raw = await download(url);
  const isGif = entry.key.endsWith('.gif');
  let bytes, contentType;
  if (isGif) {
    bytes = raw;                          // keep animation intact
    contentType = 'image/gif';
  } else {
    bytes = await sharp(raw)
      .rotate()                           // honour EXIF orientation
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    contentType = 'image/webp';
  }
  const tmp = path.join(TMP_DIR, entry.key.replace(/\//g, '_'));
  await writeFile(tmp, bytes);
  await execFileP('npx', [
    'wrangler', 'r2', 'object', 'put', `${BUCKET}/${entry.key}`,
    '--file', tmp,
    '--content-type', contentType,
    '--cache-control', CACHE_CONTROL,
    '--remote',
  ], { cwd: ROOT, env: process.env, maxBuffer: 1 << 24 });
  entry.status = 'done';
  entry.bytes = bytes.length;
  await saveManifest(manifest);
  console.log(`  ✓ ${url.slice(0, 55)} → ${entry.key} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

async function upload(manifest, limit) {
  await mkdir(TMP_DIR, { recursive: true });
  let pending = Object.entries(manifest.entries).filter(([, e]) => e.status !== 'done');
  if (limit) pending = pending.slice(0, limit);
  console.log(`upload: ${pending.length} pending (concurrency ${CONCURRENCY})`);
  let idx = 0, ok = 0, fail = 0;
  async function worker() {
    while (idx < pending.length) {
      const [url, entry] = pending[idx++];
      try { await processOne(url, entry, manifest); ok++; }
      catch (err) {
        fail++;
        entry.status = 'error';
        entry.error = String(err.message || err).slice(0, 200);
        await saveManifest(manifest);
        console.log(`  ✗ ${url.slice(0, 55)} — ${entry.error}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  console.log(`upload done: ${ok} ok, ${fail} failed`);
}

async function rewrite(manifest) {
  const done = Object.entries(manifest.entries).filter(([, e]) => e.status === 'done');
  if (!done.length) { console.log('rewrite: nothing uploaded yet'); return; }
  const files = await walk(SRC_DIR);
  let changedFiles = 0, replacements = 0;
  for (const f of files) {
    let text = await readFile(f, 'utf8');
    let changed = false;
    for (const [url, entry] of done) {
      if (text.includes(url)) {
        text = text.split(url).join(entry.newUrl);
        replacements++;
        changed = true;
      }
    }
    if (changed) { await writeFile(f, text); changedFiles++; }
  }
  console.log(`rewrite: ${replacements} replacements across ${changedFiles} files`);
}

function status(manifest) {
  const all = Object.values(manifest.entries);
  const by = (s) => all.filter(e => e.status === s).length;
  console.log(`manifest: ${all.length} total — ${by('done')} done, ${by('pending')} pending, ${by('error')} error`);
  const errs = Object.entries(manifest.entries).filter(([, e]) => e.status === 'error');
  if (errs.length) {
    console.log('errors:');
    for (const [url, e] of errs.slice(0, 20)) console.log(`  ${url.slice(0, 55)} — ${e.error}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  const cmd = process.argv[2] || 'status';
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 0;
  const manifest = await loadManifest();

  if (cmd === 'collect') { await collect(manifest); }
  else if (cmd === 'upload') { await upload(manifest, limit); }
  else if (cmd === 'rewrite') { await rewrite(manifest); }
  else if (cmd === 'all') { await collect(manifest); await upload(manifest, limit); await rewrite(manifest); }
  else { status(manifest); }
}

main().catch(err => { console.error(err); process.exit(1); });
