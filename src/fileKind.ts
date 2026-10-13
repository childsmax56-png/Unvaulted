// Detects what a catalog link actually points at before we hand it to the
// audio player. Stems especially are often uploaded as .zip/.rar bundles
// (ProTools sessions, multitrack packs) which an <audio> element can't play —
// those rows should send the user to the host page instead of erroring.
//
// Probes are cheap and CORS-friendly:
//   pillows.su   — 16-byte Range GET on api.pillows.su/api/get (content-type + magic bytes)
//   pixeldrain   — /api/file/{id}/info JSON (mime_type + name)
//   imgur.gg     — /api/file/{id} JSON (type + name)
// Results are cached in memory and sessionStorage so a row is probed once per tab.

import { useEffect, useState, type RefObject } from 'react';

export type FileKind = 'audio' | 'video' | 'archive' | 'image' | 'missing' | 'unknown';

/** Kinds the audio player can't handle — open the host page instead. */
export function isNonPlayableKind(kind: FileKind | undefined): boolean {
  return kind === 'archive' || kind === 'image' || kind === 'missing';
}

const STORAGE_KEY = 'fileKind:v1';
const PROBE_TIMEOUT_MS = 6000;
const MAX_CONCURRENT = 4;

const cache = new Map<string, FileKind>();
const inflight = new Map<string, Promise<FileKind>>();

try {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, FileKind>)) cache.set(k, v);
} catch { /* storage unavailable */ }

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      // 'unknown' / 'missing' can be transient (timeouts, host hiccups) — don't pin them for the session.
      const out: Record<string, FileKind> = {};
      cache.forEach((v, k) => { if (v !== 'unknown' && v !== 'missing') out[k] = v; });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch { /* quota / private mode */ }
  }, 500);
}

// --- concurrency gate -------------------------------------------------------
let active = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(r => waiting.push(r));
  active++;
  try { return await fn(); } finally {
    active--;
    waiting.shift()?.();
  }
}

// --- classification ---------------------------------------------------------
const ARCHIVE_EXT = /\.(zip|rar|7z|tar|gz|tgz)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav|flac|aiff?|ogg|opus|aac)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|mkv)$/i;

function classify(contentType: string, name: string, bytes?: Uint8Array): FileKind {
  const ct = contentType.toLowerCase();
  const n = name.trim().toLowerCase();
  if (ARCHIVE_EXT.test(n)) return 'archive';
  if (/zip|rar|7z|x-tar|gzip|compressed/.test(ct)) return 'archive';
  if (bytes && bytes.length >= 4) {
    const b = bytes;
    if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return 'archive'; // PK
    if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return 'archive'; // Rar!
    if (b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) return 'archive'; // 7z
  }
  if (AUDIO_EXT.test(n) || ct.startsWith('audio/')) return 'audio';
  if (IMAGE_EXT.test(n) || ct.startsWith('image/')) return 'image';
  if (VIDEO_EXT.test(n) || ct.startsWith('video/')) return 'video';
  if (bytes && bytes.length >= 4) {
    const s = String.fromCharCode(...bytes.slice(0, 4));
    if (s.startsWith('ID3') || s === 'fLaC' || s === 'RIFF' || s === 'OggS' || s === 'FORM') return 'audio';
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio'; // MPEG frame sync
  }
  return 'unknown';
}

/** Read at most `max` bytes from a response without downloading the whole body
 *  (some hosts ignore Range and send the full file). */
async function readHead(res: Response, max = 16): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const out = new Uint8Array(max);
  let len = 0;
  try {
    while (len < max) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const take = Math.min(value.length, max - len);
      out.set(value.subarray(0, take), len);
      len += take;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out.subarray(0, len);
}

function idAfter(url: string, marker: string): string {
  return url.split(marker)[1]?.split(/[?#/]/)[0] || '';
}

async function probe(url: string, signal: AbortSignal): Promise<FileKind> {
  if (ARCHIVE_EXT.test(url.split(/[?#]/)[0])) return 'archive';

  if (/(pillows|pillowcase)\.su\/f\//i.test(url)) {
    const id = idAfter(url, '/f/');
    if (!id) return 'unknown';
    const res = await fetch(`https://api.pillows.su/api/get/${id}`, { headers: { Range: 'bytes=0-15' }, signal });
    if (res.status === 404 || res.status === 410) return 'missing';
    if (!res.ok) return 'unknown';
    return classify(res.headers.get('content-type') || '', '', await readHead(res));
  }

  if (/pixeldrain\.com\/u\//i.test(url)) {
    const id = idAfter(url, '/u/');
    if (!id) return 'unknown';
    const res = await fetch(`https://pixeldrain.com/api/file/${id}/info`, { signal });
    if (res.status === 404) return 'missing';
    if (!res.ok) return 'unknown';
    const info = await res.json();
    return classify(info?.mime_type || '', info?.name || '');
  }

  if (/imgur\.gg\/f\//i.test(url)) {
    const id = idAfter(url, '/f/');
    if (!id) return 'unknown';
    const res = await fetch(`https://${new URL(url).host}/api/file/${id}`, { signal });
    if (res.status === 404) return 'missing';
    if (!res.ok) return 'unknown';
    const info = await res.json();
    return classify(info?.type || '', info?.name || '');
  }

  return 'unknown';
}

export function getCachedFileKind(url: string): FileKind | undefined {
  return cache.get(url);
}

/** Can this link be probed at all? Other hosts resolve to 'unknown'. */
export function isProbeableLink(url: string): boolean {
  return /(pillows|pillowcase)\.su\/f\/|pixeldrain\.com\/u\/|imgur\.gg\/f\//i.test(url) || ARCHIVE_EXT.test(url.split(/[?#]/)[0]);
}

export function probeFileKind(url: string): Promise<FileKind> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  if (!isProbeableLink(url)) return Promise.resolve('unknown');
  const pending = inflight.get(url);
  if (pending) return pending;

  const p = withSlot(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      return await probe(url, ctrl.signal);
    } catch {
      return 'unknown' as FileKind;
    } finally {
      clearTimeout(timer);
    }
  }).then(kind => {
    cache.set(url, kind);
    inflight.delete(url);
    persist();
    return kind;
  });
  inflight.set(url, p);
  return p;
}

/** Probe `url` once the element behind `ref` scrolls near the viewport. */
export function useFileKind(url: string, ref: RefObject<Element | null>, enabled = true): FileKind | undefined {
  const [kind, setKind] = useState<FileKind | undefined>(() => (url ? cache.get(url) : undefined));

  useEffect(() => {
    setKind(url ? cache.get(url) : undefined);
    if (!enabled || !url || cache.has(url) || !isProbeableLink(url)) return;
    const el = ref.current;
    let cancelled = false;
    const run = () => { probeFileKind(url).then(k => { if (!cancelled) setKind(k); }); };
    if (!el || typeof IntersectionObserver === 'undefined') { run(); return () => { cancelled = true; }; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); run(); }
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [url, enabled]);

  return kind;
}
