import {
  CUSTOM_IMAGES,
  ALBUM_RELEASE_DATES,
  ALBUM_DESCRIPTIONS,
  ALBUM_SONG_COUNTS,
  SITE_NAME,
  SITE_URL,
} from '../src/artist.config';
import { buildCard } from './api/og/_card';

// Replicates src/utils.tsx createSlug — keep in sync if that changes
function createSlug(name: string): string {
  return encodeURIComponent(
    name
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
  );
}

function findEraBySlug(rawSlug: string) {
  const target = decodeURIComponent(rawSlug).toLowerCase();
  for (const eraName of Object.keys(ALBUM_RELEASE_DATES)) {
    const slug = createSlug(eraName);
    if (decodeURIComponent(slug).toLowerCase() === target) {
      return {
        name: eraName,
        image: CUSTOM_IMAGES[eraName] || '',
        date: ALBUM_RELEASE_DATES[eraName],
        description: ALBUM_DESCRIPTIONS[eraName] || '',
        songCount: ALBUM_SONG_COUNTS[eraName] ?? null,
      };
    }
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildDescription(era: NonNullable<ReturnType<typeof findEraBySlug>>): string {
  const parts: string[] = [];

  if (era.songCount !== null) parts.push(`${era.songCount} songs`);
  if (era.date && !era.date.includes('????')) parts.push(era.date);

  const statLine = parts.join(' · ');
  const descText = era.description.trim();

  if (statLine && descText) {
    const remaining = 280 - statLine.length - 3; // 3 for " · "
    const excerpt = remaining > 40
      ? descText.slice(0, remaining).trimEnd() + (descText.length > remaining ? '…' : '')
      : '';
    return excerpt ? `${statLine} · ${excerpt}` : statLine;
  }

  if (statLine) return statLine;

  return descText.slice(0, 280).trimEnd() + (descText.length > 280 ? '…' : '');
}

// Link-preview crawlers. Only these get share-card <meta> rewriting, so real
// visitors never pay for the catalog lookup.
const PREVIEW_BOT_RE = /discordbot|twitterbot|facebookexternalhit|slackbot|telegrambot|whatsapp|linkedinbot|redditbot|embedly|skypeuripreview|applebot|iframely|mastodon|bluesky|cardyb|pinterest|vkshare|google-pagerenderer|snapchat/i;

// Paths a share card exists for: tracker / era / song pages, shared playlists, profiles.
function isCardPath(url: URL): boolean {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'api' || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return false;
  if (parts[0] === 'playlists') return url.searchParams.has('shared');
  if (parts[0] === 'u') return parts.length === 2;
  return parts.length === 1 || ((parts[1] === 'album' || parts[1] === 'related') && parts.length === 3);
}

async function withShareCard(context: Parameters<PagesFunction<Env>>[0], url: URL): Promise<Response> {
  const response = await context.next();
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
  const pathAndQuery = url.pathname + url.search;
  const card = await buildCard(url.origin, pathAndQuery).catch(() => null);
  if (!card) return response;

  // Rendered PNG cards come from the og-image Worker (workers/og-image) once it's
  // deployed and OG_CARDS=1 is set; until then previews use the cover art.
  const image = (context.env as any).OG_CARDS === '1'
    ? `${url.origin}/og/card.png?path=${encodeURIComponent(pathAndQuery)}`
    : card.image || `${url.origin}/og-image.jpg`;
  const large = (context.env as any).OG_CARDS === '1' || card.kind !== 'song';
  const html = (await response.text())
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(card.pageTitle)}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(card.pageTitle)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(card.description)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url.href)}$2`)
    // Discord tints the embed's side bar with theme-color.
    .replace(/(<meta name="theme-color" content=")[^"]*(")/, `$1${esc(card.accent)}$2`)
    .replace('</head>', `  <meta property="og:site_name" content="UNVAULTED" />
  <meta name="twitter:card" content="${large ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${esc(card.pageTitle)}" />
  <meta name="twitter:description" content="${esc(card.description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
</head>`);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html;charset=UTF-8');
  headers.delete('content-length');
  return new Response(html, { status: response.status, headers });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  if (context.request.method === 'GET'
    && PREVIEW_BOT_RE.test(context.request.headers.get('user-agent') || '')
    && isCardPath(url)) {
    return withShareCard(context, url);
  }

  let rawSlug: string | null = null;
  if (path.startsWith('/album/')) rawSlug = path.slice('/album/'.length);
  else if (path.startsWith('/related/')) rawSlug = path.slice('/related/'.length);

  if (!rawSlug) return context.next();

  const era = findEraBySlug(rawSlug);
  if (!era) return context.next();

  const response = await context.next();
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  const html = await response.text();

  const title = `${era.name} | ${SITE_NAME}`;
  const desc = buildDescription(era);
  const imageUrl = era.image;
  const pageUrl = `${SITE_URL.replace(/\/$/, '')}${path}`;

  const twitterTags = `
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />`;

  const modified = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/,   `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/,   `$1${esc(imageUrl)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/,     `$1${esc(pageUrl)}$2`)
    .replace('</head>', `  <meta property="og:site_name" content="${esc(SITE_NAME)}" />${twitterTags}\n</head>`);

  return new Response(modified, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'content-type': 'text/html;charset=UTF-8',
    },
  });
};
