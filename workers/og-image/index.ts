// UNVAULTED share-card renderer — serves unvaulted.cc/og/card.png?path=…
//
// Card *data* comes from the Pages app (/api/og/card, built by
// functions/api/og/_card.ts); this Worker only lays it out and rasterises it
// with satori + resvg (workers-og). It lives outside the Pages project because
// the WASM renderer would roughly triple the Pages Functions bundle.
import { ImageResponse } from 'workers-og';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff';
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff';
import inter900 from '@fontsource/inter/files/inter-latin-900-normal.woff';

interface Env { SITE_ORIGIN: string }

interface Card {
  kind: 'tracker' | 'era' | 'song' | 'playlist' | 'profile';
  eyebrow: string;
  title: string;
  subtitle: string;
  chips: string[];
  rows: { name: string; sub?: string }[];
  image: string | null;
  accent: string;
}

const W = 1200;
const H = 630;
const RENDER_VERSION = '1';

// Minimal element builder (satori takes React-element-shaped objects).
type Node = { type: string; props: Record<string, unknown> } | string | null;
function h(type: string, style: Record<string, unknown>, ...children: Node[]): Node {
  const kids = children.filter((c) => c !== null && c !== '');
  return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [245, 197, 24];
  const v = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

// Dark accents (e.g. #8b0000) vanish on black — lift them for text use.
function readableAccent(hex: string): string {
  let [r, g, b] = hexToRgb(hex);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum < 110) {
    const k = 110 / Math.max(lum, 1);
    [r, g, b] = [r, g, b].map((c) => Math.min(255, Math.round(c * k + 40)));
  }
  return `rgb(${r}, ${g}, ${b})`;
}

async function loadImage(src: string | null): Promise<string | null> {
  if (!src) return null;
  try {
    // Resize + transcode on the edge when Image Transformations is on for the
    // zone; otherwise this is a plain fetch of the original.
    const res = await fetch(src, {
      cf: { image: { width: 560, height: 560, fit: 'cover', format: 'jpeg', quality: 85 }, cacheTtl: 86400 },
    } as RequestInit);
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(type)) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 6_000_000) return null;
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function titleSize(t: string, hasRows: boolean): number {
  const n = t.length;
  if (hasRows) return n <= 16 ? 72 : n <= 28 ? 58 : 46;
  return n <= 14 ? 92 : n <= 24 ? 76 : n <= 40 ? 60 : 48;
}

function layout(card: Card, image: string | null): Node {
  const [r, g, b] = hexToRgb(card.accent);
  const accent = readableAccent(card.accent);
  const hasRows = card.rows.length > 0;
  const round = card.kind === 'profile' ? 999 : 28;

  const art = image
    ? { type: 'img', props: { src: image, width: 440, height: 440, style: { width: 440, height: 440, borderRadius: round, objectFit: 'cover', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' } } }
    : h('div', {
        width: 440, height: 440, borderRadius: round, alignItems: 'center', justifyContent: 'center',
        backgroundImage: `linear-gradient(135deg, rgba(${r},${g},${b},0.9), rgba(${r},${g},${b},0.25))`,
        fontSize: 220, fontWeight: 900, color: 'rgba(255,255,255,0.9)',
      }, (card.title.match(/[\p{L}\p{N}]/u)?.[0] || 'U').toUpperCase());

  const chips = card.chips.length
    ? h('div', { flexWrap: 'wrap', gap: 12, marginTop: 28 },
        ...card.chips.map((c) => h('div', {
          padding: '10px 20px', borderRadius: 999, fontSize: 24, fontWeight: 700, color: '#fff',
          backgroundColor: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.14)',
        }, c)))
    : null;

  const rows = hasRows
    ? h('div', { flexDirection: 'column', gap: 10, marginTop: 26 },
        ...card.rows.slice(0, 3).map((row, i) => h('div', { alignItems: 'center', gap: 16 },
          h('div', { width: 36, fontSize: 24, fontWeight: 900, color: accent }, String(i + 1)),
          h('div', { flexDirection: 'column', overflow: 'hidden' },
            h('div', { fontSize: 28, fontWeight: 700, color: '#fff' }, row.name),
            row.sub ? h('div', { fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }, row.sub) : null,
          ))))
    : null;

  return h('div', {
      width: W, height: H, backgroundColor: '#09090b', color: '#fff', fontFamily: 'Inter',
      backgroundImage: `linear-gradient(120deg, rgba(${r},${g},${b},0.42) 0%, rgba(${r},${g},${b},0.08) 45%, rgba(9,9,11,1) 75%)`,
      padding: 72, gap: 64, alignItems: 'center', position: 'relative',
    },
    art,
    h('div', { flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'center' },
      h('div', { fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: accent }, card.eyebrow),
      h('div', {
        fontSize: titleSize(card.title, hasRows), fontWeight: 900, lineHeight: 1.04, marginTop: 14,
        letterSpacing: -1.5, lineClamp: 3, display: 'block',
      }, card.title),
      card.subtitle ? h('div', { fontSize: 28, fontWeight: 500, color: 'rgba(255,255,255,0.62)', marginTop: 16, lineClamp: 2, display: 'block' }, card.subtitle) : null,
      chips,
      rows,
    ),
    h('div', { position: 'absolute', right: 56, bottom: 40, alignItems: 'center', gap: 14 },
      h('div', { fontSize: 26, fontWeight: 900, letterSpacing: 1 }, 'UNVAULTED'),
      h('div', { fontSize: 22, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }, 'unvaulted.cc'),
    ),
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/og/card.png') return new Response('Not found', { status: 404 });
    const path = url.searchParams.get('path') || '';
    if (!path.startsWith('/')) return new Response('Bad path', { status: 400 });

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/og/card.png?path=${encodeURIComponent(path)}&r=${RENDER_VERSION}`);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const fallback = () => Response.redirect(`${env.SITE_ORIGIN}/og-image.jpg`, 302);
    const dataRes = await fetch(`${env.SITE_ORIGIN}/api/og/card?path=${encodeURIComponent(path)}`);
    if (!dataRes.ok) return fallback();
    const card = await dataRes.json() as Card | null;
    if (!card) return fallback();

    try {
      const rendered = new ImageResponse(layout(card, await loadImage(card.image)) as any, {
        width: W,
        height: H,
        emoji: 'twemoji',
        fonts: [
          { name: 'Inter', data: inter500, weight: 500, style: 'normal' },
          { name: 'Inter', data: inter700, weight: 700, style: 'normal' },
          { name: 'Inter', data: inter900, weight: 900, style: 'normal' },
        ],
      });
      if (!rendered.ok) throw new Error(`render status ${rendered.status}`);
      const res = new Response(await rendered.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${card.kind === 'profile' ? 600 : 86400}` },
      });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch (e) {
      console.error('render failed', path, e);
      return fallback();
    }
  },
};
