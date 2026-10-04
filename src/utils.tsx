import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { saveAs } from 'file-saver';
import { useSettings } from './SettingsContext';
import { activeConfig } from './artists/activeConfig';

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim();
}

// Firing dozens of fetches at once via Promise.all hits per-host connection
// limits and upstream rate limiting, causing many requests to time out.
// Running a bounded number at a time (with a couple of retries on failure)
// lets large batches finish instead of dropping most of them.
export async function runWithConcurrencyLimit<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = 4,
  retries = 2,
  onProgress?: (completed: number, total: number) => void,
  onItemStart?: (item: T) => void,
  onItemDone?: (item: T) => void,
): Promise<void> {
  let cursor = 0;
  let completed = 0;
  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      onItemStart?.(item);
      let attempt = 0;
      while (true) {
        try {
          await worker(item, index);
          break;
        } catch (err) {
          attempt++;
          if (attempt > retries) {
            console.error('Failed after retries:', err);
            break;
          }
        }
      }
      onItemDone?.(item);
      completed++;
      onProgress?.(completed, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()));
}

// Cover art and photos are stored as full-resolution originals on slow, free
// hosts (i.ibb.co accounts for 400+ of them). Loading those originals for a
// 48px thumbnail is the main reason images crawl in. Route images through
// Cloudflare Image Transformations so they're resized to roughly the size we
// display and cached on Cloudflare's edge instead of hammering the origin host
// on every view. The feature is only enabled on the production zone; on local
// dev and *.pages.dev previews we serve the original untouched.
//
// IMPORTANT: the unvaulted.cc zone has Transformations enabled but currently
// only permits transforming images the zone itself serves. Transforming a
// REMOTE origin (i.ibb.co, pillows.su, …) returns `403 cf-not-resized`, so
// sending remote covers through the transform just wastes a round-trip before
// the onError fallback re-fetches the full original — which is why era covers
// (e.g. in the mini player) appeared to hang. Until the zone has "resize images
// from any origin" enabled, we serve remote images directly. Once that toggle
// is on in the Cloudflare dashboard, flip REMOTE_IMAGE_RESIZE to true to
// re-enable resizing of the big remote originals.
const REMOTE_IMAGE_RESIZE = false;
export function optimizedImage(src: string | undefined | null, width = 400): string | undefined {
  if (!src) return src ?? undefined;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src; // inline / object URLs
  if (!/^https?:\/\//i.test(src)) return src;                         // app-hosted relative asset
  if (src.includes('/cdn-cgi/image/')) return src;                    // already transformed
  if (typeof window === 'undefined') return src;
  if (!window.location.hostname.endsWith('unvaulted.cc')) return src; // feature only on prod zone
  if (!REMOTE_IMAGE_RESIZE) {                                         // remote origins 403 until the zone allows them
    let host = '';
    try { host = new URL(src).hostname; } catch { return src; }
    if (!host.endsWith('unvaulted.cc')) return src;                   // serve remote covers directly
  }
  const opts = `width=${Math.round(width)},quality=82,format=auto,fit=cover`;
  return `/cdn-cgi/image/${opts}/${src}`;
}

// Browsers occasionally cache a broken/incomplete response for an image
// (e.g. a request interrupted by navigation) and keep serving it from disk
// cache, leaving the <img> blank until the user hard-refreshes. Retrying
// once with a cache-busting query param re-fetches past that bad cache entry.
export function retryImageOnError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const img = e.currentTarget;
  // If a Cloudflare-transformed URL failed (transform error, or the feature is
  // off on this host), fall back to the untransformed original once.
  if (img.src.includes('/cdn-cgi/image/') && !img.dataset.origFallback) {
    img.dataset.origFallback = '1';
    const orig = img.src.replace(/^https?:\/\/[^/]+\/cdn-cgi\/image\/[^/]+\//, '');
    if (orig && orig !== img.src) { img.src = orig; return; }
  }
  if (img.dataset.retried) return;
  img.dataset.retried = '1';
  const url = new URL(img.src, window.location.href);
  url.searchParams.set('_r', Date.now().toString());
  img.src = url.toString();
}

// Many cover-art links are stored as ibb.co *page* URLs (ibb.co/<id>), not
// direct i.ibb.co images. An <img> pointed at a page URL never loads, so those
// must be resolved to their direct image URL first. Resolution goes through our
// own edge-cached endpoint (/api/ibb-resolve), falling back to the public imgbb
// API. Results are cached in-memory and in localStorage so a given page URL is
// resolved once across the whole app (mini player, full-screen player, gallery,
// cover picker) instead of per-component.
const IMBB_CACHE_KEY = 'imbb_url_cache_v1';

function loadImbbCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(IMBB_CACHE_KEY);
    if (raw) return new Map(JSON.parse(raw));
  } catch {}
  return new Map();
}

function persistImbbCache(cache: Map<string, string>) {
  try {
    localStorage.setItem(IMBB_CACHE_KEY, JSON.stringify([...cache]));
  } catch {}
}

const imbbResolvedCache: Map<string, string> = loadImbbCache();
const imbbInFlight: Map<string, Promise<string | null>> = new Map();

async function fetchImbbDirectLink(url: string): Promise<string | null> {
  const sources = [
    `/api/ibb-resolve?url=${encodeURIComponent(url)}`,
    `https://imgbb-file-get-api.vercel.app/api?url=${url}`,
  ];
  for (const endpoint of sources) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (data?.direct_link) return data.direct_link as string;
    } catch {
      // try next source
    }
  }
  return null;
}

// Synchronous peek at the resolved-URL cache, for callers that want to seed
// initial render state without waiting on the promise.
export function peekImbbCache(url: string): string | undefined {
  return imbbResolvedCache.get(url);
}

export async function resolveImbbUrl(url: string): Promise<string | null> {
  if (imbbResolvedCache.has(url)) return imbbResolvedCache.get(url)!;
  if (imbbInFlight.has(url)) return imbbInFlight.get(url)!;

  const promise = fetchImbbDirectLink(url)
    .then((direct): string | null => {
      imbbInFlight.delete(url);
      if (direct) {
        imbbResolvedCache.set(url, direct);
        persistImbbCache(imbbResolvedCache);
        return direct;
      }
      return null;
    })
    .catch((): null => { imbbInFlight.delete(url); return null; });

  imbbInFlight.set(url, promise);
  return promise;
}

// An ibb.co page URL (not already a direct i.ibb.co image) must be resolved
// before it can render.
function needsImbbResolve(src: string | undefined | null): src is string {
  return typeof src === 'string' && src.includes('ibb.co') && !src.includes('i.ibb.co');
}

// Shared image element for remote cover art / photos. Bakes in lazy loading,
// async decoding, the no-referrer policy (hosts like i.ibb.co block hotlinks
// otherwise), the broken-cache retry, and Cloudflare resizing via `w`. Use this
// instead of a raw <img> for any remote src so a page full of covers doesn't
// fire dozens of full-size requests at once. Pass eager for above-the-fold art.
//
// Also resolves ibb.co *page* URLs to their direct image URL on the fly, so a
// cover stored as a page link (common for community/DB-backed songs) shows up
// everywhere Img is used instead of rendering a broken-image icon.
export function Img({ src, w, eager, ...rest }: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | undefined | null;
  w?: number;
  eager?: boolean;
}) {
  const mustResolve = needsImbbResolve(src);
  const [resolvedSrc, setResolvedSrc] = useState<string | null | undefined>(
    () => (mustResolve ? (imbbResolvedCache.get(src) ?? null) : src),
  );

  useEffect(() => {
    if (!needsImbbResolve(src)) { setResolvedSrc(src); return; }
    const cached = imbbResolvedCache.get(src);
    if (cached) { setResolvedSrc(cached); return; }
    setResolvedSrc(null);
    let mounted = true;
    resolveImbbUrl(src).then(direct => {
      if (!mounted) return;
      // On resolution failure fall back to the original URL so the onError
      // retry still gets a chance rather than leaving a permanent blank.
      setResolvedSrc(direct ?? src);
    });
    return () => { mounted = false; };
  }, [src]);

  // Still resolving a page URL — render nothing so the container's own
  // background shows through instead of a broken-image icon.
  if (mustResolve && resolvedSrc == null) return null;

  return (
    <img
      src={optimizedImage(resolvedSrc, w)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={retryImageOnError}
      {...rest}
    />
  );
}

// When running under /:artist/ prefix on a unified host (e.g. unvaulted.cc/cactigold/),
// window.location.pathname includes the artist segment. Components that read/write
// window.location.pathname directly (e.g. for sub-route deep-linking) must strip/restore
// this prefix themselves, or a pushState with a bare path like "/stems/foo" will be
// mis-parsed by the top-level "/:artist/*" route as artist="stems" on the next navigation,
// bouncing the user to the homepage.
function getArtistUrlPrefix(): string {
  const p = `/${activeConfig.slug}`;
  const loc = window.location.pathname;
  return (loc === p || loc.startsWith(p + '/')) ? p : '';
}
export const relPath = (abs: string) => {
  const prefix = getArtistUrlPrefix();
  return prefix && abs.startsWith(prefix) ? (abs.slice(prefix.length) || '/') : abs;
};
export const absPath = (rel: string) => {
  const prefix = getArtistUrlPrefix();
  return rel === '/' ? (prefix || '/') : prefix + rel;
};

// Delegate all artist-specific constants to the mutable active config.
// Components remount on artist change (key={slug}), so reads always reflect
// the config that was set before the remount.
export const getArtistName = (eraName: string | undefined) => activeConfig.getArtistName(eraName);
export const CUSTOM_IMAGES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, k: string) => activeConfig.CUSTOM_IMAGES[k],
  has: (_, k: string) => k in activeConfig.CUSTOM_IMAGES,
  ownKeys: () => Object.keys(activeConfig.CUSTOM_IMAGES),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: activeConfig.CUSTOM_IMAGES[k] }),
});
export const ALBUM_RELEASE_DATES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, k: string) => activeConfig.ALBUM_RELEASE_DATES[k],
  has: (_, k: string) => k in activeConfig.ALBUM_RELEASE_DATES,
  ownKeys: () => Object.keys(activeConfig.ALBUM_RELEASE_DATES),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: activeConfig.ALBUM_RELEASE_DATES[k] }),
});
export const HIDDEN_ALBUMS: string[] = new Proxy([] as string[], {
  get: (_, k) => typeof k === 'string' && !isNaN(+k) ? activeConfig.HIDDEN_ALBUMS[+k] : k === 'length' ? activeConfig.HIDDEN_ALBUMS.length : (activeConfig.HIDDEN_ALBUMS as any)[k],
});
export const ALBUM_DESCRIPTIONS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, k: string) => activeConfig.ALBUM_DESCRIPTIONS[k],
  has: (_, k: string) => k in activeConfig.ALBUM_DESCRIPTIONS,
  ownKeys: () => Object.keys(activeConfig.ALBUM_DESCRIPTIONS),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: activeConfig.ALBUM_DESCRIPTIONS[k] }),
});
export const ERA_DISCLAIMERS: Record<string, { text: string; linkText?: string; linkUrl?: string }> = new Proxy({} as any, {
  get: (_, k: string) => (activeConfig.ERA_DISCLAIMERS ?? {})[k],
  has: (_, k: string) => k in (activeConfig.ERA_DISCLAIMERS ?? {}),
  ownKeys: () => Object.keys(activeConfig.ERA_DISCLAIMERS ?? {}),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: (activeConfig.ERA_DISCLAIMERS ?? {})[k] }),
});
export const TAG_MAP: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, k: string) => activeConfig.TAG_MAP[k],
  has: (_, k: string) => k in activeConfig.TAG_MAP,
  ownKeys: () => Object.keys(activeConfig.TAG_MAP),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: activeConfig.TAG_MAP[k] }),
});
export const TAG_TOOLTIP_MAP: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, k: string) => activeConfig.TAG_TOOLTIP_MAP[k],
  has: (_, k: string) => k in activeConfig.TAG_TOOLTIP_MAP,
  ownKeys: () => Object.keys(activeConfig.TAG_TOOLTIP_MAP),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: activeConfig.TAG_TOOLTIP_MAP[k] }),
});
export const ERA_THEMES: Record<string, { topBanner?: string; bottomBanner?: string; bottomBannerRepeat?: boolean; miniPlayer?: string; fullPicturePlayer?: string }> = new Proxy({} as any, {
  get: (_, k: string) => activeConfig.ERA_THEMES[k],
  has: (_, k: string) => k in activeConfig.ERA_THEMES,
  ownKeys: () => Object.keys(activeConfig.ERA_THEMES),
  getOwnPropertyDescriptor: (_, k: string) => ({ configurable: true, enumerable: true, value: activeConfig.ERA_THEMES[k] }),
});

export const FILTER_TOOLTIPS: Record<string, string> = {
  'Snippet': 'Less than a minute of the song is available.',
  'Partial': 'More than a minute of the song is available.',
  'Beat Only': 'Only the instrumental of the song is available.',
  'Tagged': 'Full song is available, but with added tags not from the song itself.',
  'Stem Bounce': 'Full song that has been exported by anyone else who was not the intended person.',
  'Full': 'The entire song is available, but not the original file.',
  'OG File': 'The original entire file of a song is available.',
  'Confirmed': 'The song is unavailable, but has been confirmed to exist by people who have worked with Kanye.',
  'Rumored': 'The song is unavailable, but has been said to exist by reputable people within the leak community. Please take with a grain of salt.',
  'Conflicting Sources': "There have been reputable people who say the song does exist and reputable people who say the song doesn't exist. As it is not our place to say who's right or wrong, songs with conflicting sources will be marked as such.",

  'Not Available': 'Placeholder for unavailable songs.',
  'Recording': 'A non-digital copy is available. Usually live performances or someone playing the song.',
  'Low Quality': 'Anything lower than 128kbps (YouTube quality). Noticeably worse than High Quality or CD Quality.',
  'High Quality': 'Anything greater than or equal to 128kbps (YouTube quality) and less than 320kbps.',
  'CD Quality': 'Anything around 320kbps. Not a noticeable difference to Lossless quality.',
  'Lossless': 'Raw audio data, usually from leaked stems or sessions. Useful for audio editing, but not noticeably different to CD Quality.'
};

export const createSlug = (name: string) => encodeURIComponent(
  name
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
);

export function getSongSlug(song: any, allSongsInCollection: any[]): string {
  if (!song || !song.name) return 'NoName1';
  
  if (song.name.includes('???') || createSlug(song.name) === '') {
    let index = 1;
    const targetUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    for (const s of allSongsInCollection) {
      if ((s.name && s.name.includes('???')) || createSlug(s.name) === '') {
        const sUrl = s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '');
        if (s.name === song.name && sUrl === targetUrl && s.description === song.description) {
          return `NoName${index}`;
        }
        index++;
      }
    }
    return `NoName1`;
  }
  return createSlug(song.name) || 'NoName1';
}

export function buildArtistTag(songName: string, eraName: string | undefined, includeFeatures = true, fallbackArtist?: string): string {
  let primary: string;
  const dashIdx = songName.indexOf(' - ');
  if (dashIdx !== -1) {
    primary = songName.substring(0, dashIdx);
    Object.keys(TAG_MAP).forEach(emoji => { primary = primary.replaceAll(emoji, ''); });
    primary = primary.replace(/[️]/g, '').trim();
  } else {
    primary = fallbackArtist || getArtistName(eraName);
  }
  if (!includeFeatures) return primary;

  // Collect everyone credited as featured: (feat. X), (ft. X), (with X), (w/ X),
  // across every group in the name. Producer/ref credits are deliberately left out.
  const featured: string[] = [];
  const pattern = /[\[(](?:feat\.|ft\.|with\s+|w\/)\s*([^\])\n]+)[\])]/gi;
  let m;
  while ((m = pattern.exec(songName)) !== null) {
    m[1].split(/,|&/).map(n => n.replace(/[️]/g, '').trim()).filter(n => n && n !== '???').forEach(n => featured.push(n));
  }
  const primaryLower = primary.toLowerCase();
  const unique = [...new Set(featured)].filter(n => !primaryLower.includes(n.toLowerCase()));
  return unique.length ? `${primary} feat. ${unique.join(', ')}` : primary;
}

/**
 * Parses contributor names from a text string (song name or extra field).
 * Handles: feat., ft., prod. (by), perf., with, w/, ref.
 */
export function parseContributors(text: string): string[] {
  if (!text) return [];
  const contributors: string[] = [];

  // Match (TYPE. names) or (with names) parenthetical groups
  const pattern = /[\[(](?:feat\.|ft\.|prod\.(?:\s*by)?|perf\.|ref\.|with\s+|w\/)\s*([^\])\n]+)[\])]/gi;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    m[1].split(/,|&/).map(s => s.trim()).filter(s => s && s !== '???').forEach(n => contributors.push(n));
  }

  // strip tag emojis and deduplicate
  return [...new Set(contributors.map(c => c.replace(/[️]/g, '').trim()).filter(Boolean))];
}

/**
 * Splits a text string into segments, marking contributor names separately
 * so they can be rendered as clickable links.
 */
export function splitTextWithContributors(
  text: string
): Array<{ text: string; contributor?: string }> {
  if (!text) return [{ text }];

  const contributors = parseContributors(text);
  if (contributors.length === 0) return [{ text }];

  const segments: Array<{ text: string; contributor?: string }> = [];
  let remaining = text;

  for (const contributor of contributors) {
    const idx = remaining.indexOf(contributor);
    if (idx === -1) continue;
    if (idx > 0) segments.push({ text: remaining.slice(0, idx) });
    segments.push({ text: contributor, contributor });
    remaining = remaining.slice(idx + contributor.length);
  }
  if (remaining) segments.push({ text: remaining });
  return segments;
}

/** @deprecated use splitTextWithContributors */
export const splitSongNameWithContributors = splitTextWithContributors;

export function formatTextForNotification(text: string | undefined | null, tagsAsEmojis: boolean): string {
  if (!text) return '';
  let formattedText = text;
  const tags: string[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      if (!tagsAsEmojis) {
        tags.push(`[${tag.toUpperCase()}]`);
      }
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tagsAsEmojis) {
    return text;
  }

  if (tags.length === 0) {
    return formattedText;
  }

  return `${formattedText} ${tags.join(' ')}`.trim();
}

export function formatTextWithTags(text: string | undefined | null) {
  if (!text) return null;

  let formattedText = text;
  const tags: { emoji: string, tag: string }[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      tags.push({ emoji, tag });
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tags.length === 0) {
    return <>{formattedText}</>;
  }

  return <FormattedTextWithTags tags={tags} formattedText={formattedText} />;
}

function TagComponent({ t, tagsAsEmojis }: { t: { emoji: string, tag: string }, tagsAsEmojis: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const tooltipText = TAG_TOOLTIP_MAP[t.tag];

  const updateRect = () => {
    if (tagRef.current) {
      setRect(tagRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (isHovered) {
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [isHovered]);

  useEffect(() => {
    if (isHovered) {
      const handleDocClick = (e: MouseEvent) => {
        if (tagRef.current && !tagRef.current.contains(e.target as Node)) {
          setIsHovered(false);
        }
      };
      const timer = setTimeout(() => {
        document.addEventListener('click', handleDocClick);
        document.addEventListener('touchstart', handleDocClick);
      }, 10);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleDocClick);
        document.removeEventListener('touchstart', handleDocClick);
      };
    }
  }, [isHovered]);

  return (
    <div 
      ref={tagRef}
      className="relative flex items-center shrink-0 cursor-help"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsHovered(!isHovered);
      }}
    >
      {tagsAsEmojis ? (
        <span className="shrink-0 flex items-center justify-center text-sm">{t.emoji}</span>
      ) : (
        <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 bg-[var(--theme-color)]/10 text-[var(--theme-color)] font-bold">
          {t.tag}
        </span>
      )}

      {tooltipText && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHovered && rect && (
            <motion.div
              initial={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              animate={{ opacity: 1, x: "-50%", y: "-100%", filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                top: rect.top - 8,
                zIndex: 99999,
                transformOrigin: 'bottom center'
              }}
              className="w-48 sm:w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl pointer-events-none"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base flex items-center justify-center text-[var(--theme-color)]">{t.emoji}</span>
                  <span className="font-bold text-white text-xs">{t.tag}</span>
                </div>
                <p className="text-white/70 text-[11px] leading-snug whitespace-normal line-clamp-3">
                  {tooltipText}
                </p>
              </div>
              <div className="absolute top-full left-1/2 -ml-1.5 -mt-[1px] border-solid border-t-neutral-900 border-x-transparent border-b-transparent border-[6px]" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function FormattedTextWithTags({ tags, formattedText }: { tags: { emoji: string, tag: string }[], formattedText: string }) {
  const { settings } = useSettings();
  
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className="truncate">{formattedText}</span>
      {tags.map((t, i) => (
        <TagComponent key={i} t={t} tagsAsEmojis={settings.tagsAsEmojis} />
      ))}
    </div>
  );
}

export function getCleanSongNameWithTags(text: string | undefined | null): string {
  if (!text) return '';
  let formattedText = text;
  const tags: string[] = [];

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (formattedText.includes(emoji)) {
      tags.push(tag);
      formattedText = formattedText.split(emoji).join('').trim();
    }
  });

  formattedText = formattedText.replace(/[\uFE0F]/g, '').trim();

  if (tags.length > 0) {
    return `${formattedText} [${tags.join(', ')}]`;
  }
  return formattedText;
}

export interface SongMeta {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  artworkUrl?: string;
}

function checkMagicBytes(b: Uint8Array): '.mp3' | '.wav' | '.flac' | '.aiff' | '.zip' | '.ogg' | '.m4a' | null {
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return '.wav';
  if (b[0] === 0x66 && b[1] === 0x4C && b[2] === 0x61 && b[3] === 0x43) return '.flac';
  if (b[0] === 0x46 && b[1] === 0x4F && b[2] === 0x52 && b[3] === 0x4D) return '.aiff';
  if (b[0] === 0x50 && b[1] === 0x4B) return '.zip';
  if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return '.ogg';
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return '.m4a';
  return null;
}

export async function detectAudioExt(blob: Blob): Promise<'.mp3' | '.wav' | '.flac' | '.aiff' | '.zip' | '.ogg' | '.m4a'> {
  const header = await blob.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(header);

  // If the file starts with an ID3v2 header, skip past it and re-check.
  // Some encoders prepend ID3 tags to lossless formats (FLAC, WAV) which would
  // otherwise be misdetected as MP3.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes[3] >= 2 && bytes[3] <= 4) {
    const sizeBuf = await blob.slice(6, 10).arrayBuffer();
    const sb = new Uint8Array(sizeBuf);
    const tagSize = ((sb[0] & 0x7F) << 21) | ((sb[1] & 0x7F) << 14) | ((sb[2] & 0x7F) << 7) | (sb[3] & 0x7F);
    const afterBuf = await blob.slice(10 + tagSize, 10 + tagSize + 12).arrayBuffer();
    const match = checkMagicBytes(new Uint8Array(afterBuf));
    return match ?? '.mp3';
  }

  return checkMagicBytes(bytes) ?? '.mp3';
}

function isImageBuffer(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf, 0, 12);
  // JPEG: FF D8
  if (b[0] === 0xFF && b[1] === 0xD8) return true;
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;
  // GIF: 47 49 46
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
  // WebP: 52 49 46 46 .... 57 45 42 50
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

async function compressArtworkToJpeg(buf: ArrayBuffer, maxPx = 800, quality = 0.85): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const mime = detectMime(buf);
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width || maxPx, img.height || maxPx));
      const w = Math.max(1, Math.round((img.width || maxPx) * scale));
      const h = Math.max(1, Math.round((img.height || maxPx) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(buf); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(blobUrl);
        if (!b) { resolve(buf); return; }
        b.arrayBuffer().then(resolve).catch(() => resolve(buf));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(buf); };
    img.src = blobUrl;
  });
}

async function fetchArtworkBuffer(artworkUrl: string): Promise<ArrayBuffer | null> {
  const proxies = [
    artworkUrl,
    `https://corsproxy.io/?${encodeURIComponent(artworkUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(artworkUrl)}`,
  ];
  for (const url of proxies) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (isImageBuffer(buf)) return buf;
      }
    } catch {
      // try next proxy
    }
  }
  return null;
}

// Minimal ID3v2.3 writer using Latin-1 encoding so Windows Explorer can edit the Details tab.
// browser-id3-writer writes UTF-16 text frames (encoding 0x01) which Windows can read but not edit.
function latin1Bytes(text: string): Uint8Array {
  return new Uint8Array(Array.from(text).map(c => { const n = c.charCodeAt(0); return n <= 0xFF ? n : 63; }));
}

function id3TextFrame(id: string, text: string): Uint8Array {
  const textBytes = latin1Bytes(text);
  const content = new Uint8Array(1 + textBytes.length); // encoding byte + text
  content[0] = 0x00; // Latin-1
  content.set(textBytes, 1);
  return id3Frame(id, content);
}

function id3ApicFrame(imageData: ArrayBuffer, mimeType: string): Uint8Array {
  const mimeBytes = latin1Bytes(mimeType);
  // encoding(1) + mime + null(1) + picType(1) + description null(1) + imageData
  const content = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + imageData.byteLength);
  let i = 0;
  content[i++] = 0x00; // Latin-1
  content.set(mimeBytes, i); i += mimeBytes.length;
  content[i++] = 0x00; // null terminator for MIME
  content[i++] = 0x03; // picture type: Cover front
  content[i++] = 0x00; // empty description (null terminator)
  content.set(new Uint8Array(imageData), i);
  return id3Frame('APIC', content);
}

function id3Frame(id: string, content: Uint8Array): Uint8Array {
  const frame = new Uint8Array(10 + content.length);
  const view = new DataView(frame.buffer);
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i);
  view.setUint32(4, content.length, false);
  // bytes 8-9 are flags, left as 0x00 0x00
  frame.set(content, 10);
  return frame;
}

function stripID3v2(buffer: ArrayBuffer): ArrayBuffer {
  const b = new Uint8Array(buffer);
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b[3] >= 2 && b[3] <= 4) {
    const size = ((b[6] & 0x7F) << 21) | ((b[7] & 0x7F) << 14) | ((b[8] & 0x7F) << 7) | (b[9] & 0x7F);
    return buffer.slice(10 + size);
  }
  return buffer;
}

function detectMime(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, 4);
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  return 'image/jpeg';
}

// ─── FLAC → WAV conversion ────────────────────────────────────────────────────
// Decodes FLAC via WebAudio and re-encodes as 16-bit PCM WAV so downstream
// tag embedding can use the simpler ID3 path and players don't choke on
// the FLAC Vorbis-comment block.
function wavWriteString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

export async function flacToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  let rawBuf = await blob.arrayBuffer();
  // Strip prepended ID3v2 header — browsers' FLAC decoders don't tolerate it.
  const hdr = new Uint8Array(rawBuf, 0, Math.min(10, rawBuf.byteLength));
  if (hdr[0] === 0x49 && hdr[1] === 0x44 && hdr[2] === 0x33 && hdr[3] >= 2 && hdr[3] <= 4) {
    const tagSize = ((hdr[6] & 0x7F) << 21) | ((hdr[7] & 0x7F) << 14) | ((hdr[8] & 0x7F) << 7) | (hdr[9] & 0x7F);
    rawBuf = rawBuf.slice(10 + tagSize);
  }
  const decoded = await ctx.decodeAudioData(rawBuf);
  ctx.close();

  const numCh = decoded.numberOfChannels;
  const sr = decoded.sampleRate;
  const numSamples = decoded.length;
  const dataSize = numSamples * numCh * 2; // 16-bit = 2 bytes
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  wavWriteString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  wavWriteString(view, 8, 'WAVE');
  wavWriteString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                          // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);             // byte rate
  view.setUint16(32, numCh * 2, true);                  // block align
  view.setUint16(34, 16, true);                         // bits per sample
  wavWriteString(view, 36, 'data'); view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, decoded.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }

  return new Blob([buf], { type: 'audio/wav' });
}

// ─── Any audio → MP3 transcode ────────────────────────────────────────────────
// Decodes any browser-playable audio (WAV/FLAC/M4A/OGG/AIFF/…) via WebAudio and
// re-encodes it to a 320kbps MP3 with lamejs. Used by the "Download as MP3"
// setting so files are accepted by Spotify's Local Files, which ignores anything
// that isn't a genuine MP3/M4A. Throws if the browser can't decode the source.
function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

const MP3_SAMPLE_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

export async function blobToMp3(blob: Blob): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');

  const ctx = new AudioContext();
  let rawBuf = await blob.arrayBuffer();
  // Strip a prepended ID3v2 header — browsers' decoders don't tolerate it.
  const hdr = new Uint8Array(rawBuf, 0, Math.min(10, rawBuf.byteLength));
  if (hdr[0] === 0x49 && hdr[1] === 0x44 && hdr[2] === 0x33 && hdr[3] >= 2 && hdr[3] <= 4) {
    const tagSize = ((hdr[6] & 0x7F) << 21) | ((hdr[7] & 0x7F) << 14) | ((hdr[8] & 0x7F) << 7) | (hdr[9] & 0x7F);
    rawBuf = rawBuf.slice(10 + tagSize);
  }
  let decoded = await ctx.decodeAudioData(rawBuf);
  ctx.close();

  // lamejs only handles the MPEG sample rates; resample anything else to 44.1kHz.
  if (!MP3_SAMPLE_RATES.includes(decoded.sampleRate)) {
    const target = 44100;
    const offline = new OfflineAudioContext(decoded.numberOfChannels, Math.ceil(decoded.duration * target), target);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    decoded = await offline.startRendering();
  }

  const channels = Math.min(decoded.numberOfChannels, 2);
  const encoder = new Mp3Encoder(channels, decoded.sampleRate, 320);
  const left = floatToInt16(decoded.getChannelData(0));
  const right = channels > 1 ? floatToInt16(decoded.getChannelData(1)) : null;

  const BLOCK = 1152;
  const mp3Chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const chunk = right
      ? encoder.encodeBuffer(l, right.subarray(i, i + BLOCK))
      : encoder.encodeBuffer(l);
    if (chunk.length > 0) mp3Chunks.push(new Uint8Array(chunk));
  }
  const tail = encoder.flush();
  if (tail.length > 0) mp3Chunks.push(new Uint8Array(tail));

  return new Blob(mp3Chunks as BlobPart[], { type: 'audio/mpeg' });
}

// Embeds ID3v2 tags into a WAV file as an 'id3 ' RIFF chunk.
// This keeps the file starting with "RIFF" (valid WAV) while carrying full
// ID3 metadata (title, artist, album, year, artwork) readable by macOS Music,
// foobar2000, VLC, and all other modern players.
export async function embedWAVTags(blob: Blob, meta: SongMeta, cleanTitle: string): Promise<Blob> {
  let src = new Uint8Array(await blob.arrayBuffer());
  // Strip a prepended ID3v2 header so we can reach the RIFF signature below.
  if (src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33 && src[3] >= 2 && src[3] <= 4) {
    const tagSize = ((src[6] & 0x7F) << 21) | ((src[7] & 0x7F) << 14) | ((src[8] & 0x7F) << 7) | (src[9] & 0x7F);
    src = src.slice(10 + tagSize);
  }
  if (src[0] !== 0x52 || src[1] !== 0x49 || src[2] !== 0x46 || src[3] !== 0x46) return blob;

  // Build ID3v2.3 tag
  const frames: Uint8Array[] = [];
  const title = meta.title || cleanTitle;
  if (title)       frames.push(id3TextFrame('TIT2', title));
  if (meta.artist) frames.push(id3TextFrame('TPE1', meta.artist));
  if (meta.album)  frames.push(id3TextFrame('TALB', meta.album));
  if (meta.year) {
    const y = parseInt(meta.year, 10);
    if (!isNaN(y)) frames.push(id3TextFrame('TYER', String(y)));
  }
  if (meta.artworkUrl) {
    const artBuf = await fetchArtworkBuffer(meta.artworkUrl);
    if (artBuf) frames.push(id3ApicFrame(artBuf, detectMime(artBuf)));
  }
  if (frames.length === 0) return blob;

  const framesSize = frames.reduce((s, f) => s + f.length, 0);
  const id3 = new Uint8Array(10 + framesSize);
  const id3v = new DataView(id3.buffer);
  id3[0] = 0x49; id3[1] = 0x44; id3[2] = 0x33; // "ID3"
  id3[3] = 0x03; id3[4] = 0x00; id3[5] = 0x00;  // v2.3, no flags
  id3v.setUint8(6, (framesSize >> 21) & 0x7F);
  id3v.setUint8(7, (framesSize >> 14) & 0x7F);
  id3v.setUint8(8, (framesSize >>  7) & 0x7F);
  id3v.setUint8(9,  framesSize        & 0x7F);
  let off = 10;
  for (const f of frames) { id3.set(f, off); off += f.length; }

  // Wrap in 'id3 ' RIFF chunk (pad to even length)
  const padded = id3.length + (id3.length % 2);
  const chunk = new Uint8Array(8 + padded);
  const cv = new DataView(chunk.buffer);
  wavWriteString(cv, 0, 'id3 '); cv.setUint32(4, id3.length, true);
  chunk.set(id3, 8);

  const out = new Uint8Array(src.length + chunk.length);
  out.set(src); out.set(chunk, src.length);
  new DataView(out.buffer).setUint32(4, out.length - 8, true); // update RIFF size
  return new Blob([out], { type: 'audio/wav' });
}

export async function embedID3Tags(blob: Blob, meta: SongMeta, cleanTitle: string, mimeType = 'audio/mpeg'): Promise<Blob> {
  const audioBuffer = await blob.arrayBuffer();
  const audio = stripID3v2(audioBuffer);

  const frames: Uint8Array[] = [];
  const title = meta.title || cleanTitle;
  if (title) frames.push(id3TextFrame('TIT2', title));
  if (meta.artist) frames.push(id3TextFrame('TPE1', meta.artist));
  if (meta.album) frames.push(id3TextFrame('TALB', meta.album));
  if (meta.year) {
    const y = parseInt(meta.year, 10);
    if (!isNaN(y)) frames.push(id3TextFrame('TYER', String(y)));
  }

  if (meta.artworkUrl) {
    const artBuffer = await fetchArtworkBuffer(meta.artworkUrl);
    if (artBuffer) {
      frames.push(id3ApicFrame(artBuffer, detectMime(artBuffer)));
    }
  }

  const framesSize = frames.reduce((s, f) => s + f.length, 0);
  const tag = new Uint8Array(10 + framesSize);
  const view = new DataView(tag.buffer);
  tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33; // "ID3"
  tag[3] = 0x03; tag[4] = 0x00; // version 2.3.0
  tag[5] = 0x00; // no flags
  // synchsafe tag body size
  view.setUint8(6, (framesSize >> 21) & 0x7F);
  view.setUint8(7, (framesSize >> 14) & 0x7F);
  view.setUint8(8, (framesSize >> 7) & 0x7F);
  view.setUint8(9, framesSize & 0x7F);
  let offset = 10;
  for (const f of frames) { tag.set(f, offset); offset += f.length; }

  const out = new Uint8Array(tag.length + audio.byteLength);
  out.set(tag, 0);
  out.set(new Uint8Array(audio), tag.length);
  return new Blob([out], { type: mimeType });
}

// ─── FLAC tag embedding ────────────────────────────────────────────────────
// FLAC uses Vorbis comments (type 4) and PICTURE blocks (type 6), not ID3.

function u32LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]);
}
function u32BE(n: number): Uint8Array {
  return new Uint8Array([(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]);
}
function flacBlockHdr(type: number, isLast: boolean, length: number): Uint8Array {
  return new Uint8Array([
    (isLast ? 0x80 : 0x00) | (type & 0x7F),
    (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF,
  ]);
}
function utf8B(s: string): Uint8Array { return new TextEncoder().encode(s); }

function buildVorbisComment(comments: string[]): Uint8Array {
  const vendor = utf8B('reference libFLAC 1.3.4 20220220');
  const parts: Uint8Array[] = [u32LE(vendor.length), vendor, u32LE(comments.length)];
  for (const c of comments) { const cb = utf8B(c); parts.push(u32LE(cb.length), cb); }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function buildFLACPicture(imgData: ArrayBuffer, mime: string): Uint8Array {
  const mimeB = utf8B(mime); const imgB = new Uint8Array(imgData);
  const parts: Uint8Array[] = [
    u32BE(3), u32BE(mimeB.length), mimeB,
    u32BE(0), u32BE(0), u32BE(0), u32BE(0), u32BE(0),
    u32BE(imgB.length), imgB,
  ];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export async function embedFLACTags(blob: Blob, meta: SongMeta, cleanTitle: string): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  let src = new Uint8Array(buf);
  // Strip a prepended ID3v2 header so we can reach the fLaC signature below.
  if (src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33 && src[3] >= 2 && src[3] <= 4) {
    const tagSize = ((src[6] & 0x7F) << 21) | ((src[7] & 0x7F) << 14) | ((src[8] & 0x7F) << 7) | (src[9] & 0x7F);
    src = src.slice(10 + tagSize);
  }
  // Must start with fLaC
  if (src[0] !== 0x66 || src[1] !== 0x4C || src[2] !== 0x61 || src[3] !== 0x43) return blob;

  // Walk existing metadata blocks; strip any existing VORBIS_COMMENT (4) / PICTURE (6)
  const kept: { type: number; body: Uint8Array }[] = [];
  let pos = 4; let audioStart = 4;
  while (pos + 4 <= src.length) {
    const hdr = src[pos]; const isLast = (hdr & 0x80) !== 0; const type = hdr & 0x7F;
    if (type === 0x7F) break;
    const len = (src[pos + 1] << 16) | (src[pos + 2] << 8) | src[pos + 3];
    if (pos + 4 + len > src.length) break;
    if (type !== 4 && type !== 6) kept.push({ type, body: src.slice(pos + 4, pos + 4 + len) });
    audioStart = pos + 4 + len; pos = audioStart;
    if (isLast) break;
  }

  // Build Vorbis comment fields
  // Field names follow the Vorbis comment spec and Apple Music's expected keys.
  const comments: string[] = [];
  const title = meta.title || cleanTitle;
  if (title) comments.push(`TITLE=${title}`);
  if (meta.artist) {
    comments.push(`ARTIST=${meta.artist}`);
    // Apple Music uses ALBUMARTIST to group tracks into albums; without it,
    // songs often appear under "Unknown Album Artist."
    comments.push(`ALBUMARTIST=${meta.artist}`);
  }
  if (meta.album) comments.push(`ALBUM=${meta.album}`);
  if (meta.year) { const y = parseInt(meta.year, 10); if (!isNaN(y)) { comments.push(`DATE=${y}`); comments.push(`YEAR=${y}`); } }

  const vcBody = buildVorbisComment(comments);
  const rawArtBuf = meta.artworkUrl ? await fetchArtworkBuffer(meta.artworkUrl) : null;
  const artBuf = rawArtBuf ? await compressArtworkToJpeg(rawArtBuf) : null;
  const picBody = artBuf ? buildFLACPicture(artBuf, 'image/jpeg') : null;

  // Reassemble: fLaC + existing blocks + VORBIS_COMMENT + optional PICTURE + audio
  const blocks: { type: number; body: Uint8Array }[] = [...kept, { type: 4, body: vcBody }];
  if (picBody) blocks.push({ type: 6, body: picBody });

  const parts: Uint8Array[] = [new Uint8Array([0x66, 0x4C, 0x61, 0x43])];
  for (let i = 0; i < blocks.length; i++) {
    const { type, body } = blocks[i];
    parts.push(flacBlockHdr(type, i === blocks.length - 1, body.length), body);
  }
  parts.push(src.slice(audioStart));

  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }

  // Verify output block structure so we can diagnose tag visibility issues
  try {
    let vp = 4; let bi = 0;
    while (vp + 4 <= out.length) {
      const vh = out[vp]; const vl = (out[vp+1] << 16) | (out[vp+2] << 8) | out[vp+3];
      const vtype = vh & 0x7F; const vlast = (vh & 0x80) !== 0;
      if (vtype === 4) {
        // Log VORBIS_COMMENT body preview
        const bodyStart = vp + 4;
        const vendorLen = out[bodyStart] | (out[bodyStart+1]<<8) | (out[bodyStart+2]<<16) | (out[bodyStart+3]<<24);
        const commentCountOff = bodyStart + 4 + vendorLen;
        const commentCount = out[commentCountOff] | (out[commentCountOff+1]<<8) | (out[commentCountOff+2]<<16) | (out[commentCountOff+3]<<24);
        console.log(`[flac verify] block[${bi}] VORBIS_COMMENT len=${vl} last=${vlast} vendorLen=${vendorLen} commentCount=${commentCount}`);
        // Log first comment
        let cp = commentCountOff + 4;
        for (let ci = 0; ci < Math.min(commentCount, 4); ci++) {
          const cl = out[cp] | (out[cp+1]<<8) | (out[cp+2]<<16) | (out[cp+3]<<24);
          const cs = new TextDecoder().decode(out.slice(cp+4, cp+4+cl));
          console.log(`  comment[${ci}]: ${cs}`);
          cp += 4 + cl;
        }
      } else {
        console.log(`[flac verify] block[${bi}] type=${vtype} len=${vl} last=${vlast}`);
      }
      bi++; vp += 4 + vl;
      if (vlast) { console.log(`[flac verify] audio starts at byte ${vp} of ${out.length}`); break; }
    }
  } catch {}

  return new Blob([out], { type: 'audio/flac' });
}

function openFallback(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  // For same-origin URLs (e.g. /api/audio-proxy?...) the download attribute is
  // respected by the browser and overrides the server's Content-Disposition
  // filename.  Cross-origin URLs ignore the attribute, but we still set it so
  // same-origin fallbacks (which are the common case) get the right name.
  if (fileName) a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  // Google app (GSA), Facebook, Instagram, and similar WebViews don't support saveAs
  return /GSA\/|FBAN|FBAV|Instagram\//.test(ua);
}

function parseOgFilename(description: string | undefined): string | null {
  if (!description) return null;
  const match = description.match(/^OG Filename:\s*(.+)$/im);
  if (!match) return null;
  const raw = match[1].trim().replace(/^["']|["']$/g, '');
  // Strip known audio extensions so extension logic below can normalize them
  return raw.replace(/\.(mp3|wav|flac|aif|aiff|m4a|ogg)$/i, '');
}

export function parseNoteDescription(description: string | undefined | null): {
  ogFilename: string | null;
  note: string | null;
} {
  if (!description) return { ogFilename: null, note: null };

  const lines = description.split('\n');
  const ogParts: string[] = [];
  let noteStartIdx = 0;
  let awaitingContinuation = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^OG Filenames?:/i.test(trimmed)) {
      const val = trimmed.replace(/^OG Filenames?:\s*/i, '').trim();
      if (val.endsWith('&')) {
        ogParts.push(val.slice(0, -1).trim());
        awaitingContinuation = true;
      } else {
        ogParts.push(val);
        awaitingContinuation = false;
      }
      noteStartIdx = i + 1;
    } else if (awaitingContinuation) {
      if (trimmed.endsWith('&')) {
        ogParts.push(trimmed.slice(0, -1).trim());
      } else {
        ogParts.push(trimmed);
        awaitingContinuation = false;
      }
      noteStartIdx = i + 1;
    }
  }

  const ogFilename = ogParts.length > 0 ? ogParts.filter(Boolean).join(' & ') : null;
  const note = lines.slice(noteStartIdx).join('\n').trim() || null;
  return { ogFilename, note };
}

// Pixeldrain blocks direct browser access (cross-site hotlink detection + the
// Cloudflare cf-worker header), so file IDs must go through a non-Cloudflare
// proxy (see pd-proxy/). The proxy host is normally supplied at build time via
// VITE_PIXELDRAIN_PROXY_URL, but we also ship a hard-coded default so Pixeldrain
// keeps working if that env var is ever missing (a lost/misconfigured env var
// is exactly what silently breaks every Pixeldrain link).
export const DEFAULT_PIXELDRAIN_PROXY_URL = 'https://pdproxy-7p26sd4ehfvg.childsmax56-png.deno.net';

// The proxy base URL with any trailing slash stripped. Prefers the build-time
// env var, falling back to the built-in default. Uses `||` (not `??`) so an
// empty-string env var also falls back instead of yielding a broken base.
export function pixeldrainProxyBase(): string {
  return (import.meta.env.VITE_PIXELDRAIN_PROXY_URL || DEFAULT_PIXELDRAIN_PROXY_URL).replace(/\/$/, '');
}

// Turn a pixeldrain.com/u/<id> page URL into a proxied direct URL. Returns null
// only when no file id can be parsed out.
export function pixeldrainProxyUrl(url: string): string | null {
  const id = url.split('/u/')[1]?.split('?')[0];
  return id ? `${pixeldrainProxyBase()}/api/${id}` : null;
}

export async function resolveUrl(url: string): Promise<{ fetchUrl: string; isImage: boolean; imageExt?: string; headers?: Record<string, string> }> {
  if (url.includes('imgur.gg/f/')) {
    const id = url.split('/f/')[1];
    const host = new URL(url).host;
    if (id) {
      const res = await fetch(`https://${host}/api/file/${id}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.cdnUrl) return { fetchUrl: data.cdnUrl, isImage: false };
      }
    }
    return { fetchUrl: url, isImage: false };
  }
  if (url.includes('pillows.su/f/')) {
    const pathPart = url.split('/f/')[1];
    return { fetchUrl: pathPart ? `https://api.pillows.su/api/download/${pathPart}` : url, isImage: false };
  }
  if (url.includes('krakenfiles.com/view/')) {
    return { fetchUrl: `/api/kraken-proxy?url=${encodeURIComponent(url)}`, isImage: false };
  }
  if (url.includes('pixeldrain.com/u/')) {
    return { fetchUrl: pixeldrainProxyUrl(url) ?? url, isImage: false };
  }
  if (url.includes('drive.google.com')) {
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return { fetchUrl: `/api/audio-proxy?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${m[1]}`)}`, isImage: false };
  }
  if (url.includes('ibb.co')) {
    // Prefer our own edge-cached resolver, falling back to the public imgbb API.
    const endpoints = [
      `/api/ibb-resolve?url=${encodeURIComponent(url)}`,
      `https://imgbb-file-get-api.vercel.app/api?url=${url}`,
    ];
    for (const endpoint of endpoints) {
      const apiRes = await fetch(endpoint).catch(() => null);
      if (apiRes && apiRes.ok) {
        const apiData = await apiRes.json().catch(() => null);
        if (apiData?.direct_link) return { fetchUrl: apiData.direct_link, isImage: true };
      }
    }
    return { fetchUrl: url, isImage: true };
  }
  if (url.match(/\.(png|jpg|jpeg)$/i) || url.startsWith('https://i.scdn.co/')) {
    const match = url.match(/\.(png|jpg|jpeg)$/i);
    return { fetchUrl: url, isImage: true, imageExt: match ? match[0] : '.png' };
  }
  return { fetchUrl: url, isImage: false };
}

async function compressImageBlob(blob: Blob, maxDim = 2048, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(out => resolve(out ?? blob), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(blob); };
    img.src = objUrl;
  });
}

export async function handleDownloadFile(url: string, suggestedName: string, tagsAsEmojis: boolean, meta?: SongMeta, description?: string, convertToMp3 = false) {
  if (!url) return;
  let finalUrl = url;
  try {
    const ogName = parseOgFilename(description);
    let fileName = ogName ?? suggestedName;
    if (!tagsAsEmojis && !ogName) {
      fileName = formatTextForNotification(suggestedName, false);
    }

    let isImage = false;
    let ext = '.mp3';

    if (url.includes('imgur.gg/f/')) {
        const id = url.split('/f/')[1];
        const host = new URL(url).host;
        if (id) {
            const res = await fetch(`https://${host}/api/file/${id}`).catch(() => null);
            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data?.cdnUrl) finalUrl = data.cdnUrl;
            }
        }
    } else if (url.includes('pillows.su/f/')) {
        const pathPart = url.split('/f/')[1];
        if (pathPart) {
            finalUrl = `/api/audio-proxy?url=${encodeURIComponent(`https://api.pillows.su/api/download/${pathPart}`)}`;
        }
    } else if (url.includes('drive.google.com')) {
        const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) finalUrl = `/api/audio-proxy?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${m[1]}`)}`;
    } else if (url.includes('i.imgur.com')) {
        finalUrl = url;
        const extMatch = url.match(/\.(mp3|mp4|m4a|wav|ogg|flac|aac)(\?|$)/i);
        if (extMatch) ext = extMatch[1].toLowerCase() === 'mp4' ? '.mp4' : `.${extMatch[1].toLowerCase()}`;
    } else if (url.includes('krakenfiles.com/view/')) {
        finalUrl = `/api/kraken-proxy?url=${encodeURIComponent(url)}`;
    } else if (url.includes('pixeldrain.com/u/')) {
        finalUrl = pixeldrainProxyUrl(url) ?? url;
    } else if (url.includes('ibb.co')) {
       isImage = true;
       ext = '';
       const apiRes = await fetch(`https://imgbb-file-get-api.vercel.app/api?url=${url}`).catch(() => null);
       if (apiRes && apiRes.ok) {
           const apiData = await apiRes.json().catch(() => null);
           if (apiData && apiData.direct_link) {
               finalUrl = apiData.direct_link;
           }
       }
    } else if (url.match(/\.(png|jpg|jpeg)$/i) || url.startsWith('https://i.scdn.co/')) {
        isImage = true;
        const match = url.match(/\.(png|jpg|jpeg)$/i);
        ext = match ? match[0] : '.png';
    } 

    if (!fileName.endsWith('.mp3') && !isImage) {
        fileName += ext;
    } else if (isImage && !fileName.match(/\.(png|jpg|jpeg)$/i)) {
        fileName += ext;
    }

    // In-app browsers (Google app, Facebook, Instagram) don't support saveAs via
    // the download attribute. Navigate directly to the download URL so the OS
    // download manager or system browser can handle it. Use the /api/download/
    // path (which includes the filename) so the server sends Content-Disposition:
    // attachment, triggering a real download instead of inline playback.
    if (isInAppBrowser()) {
      let directUrl = finalUrl;
      if (url.includes('pillows.su/f/')) {
        const pathPart = url.split('/f/')[1];
        if (pathPart) directUrl = `https://api.pillows.su/api/download/${pathPart}`;
      } else if (url.includes('drive.google.com')) {
        const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) directUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`;
      }
      window.location.href = directUrl;
      return;
    }

    let blob: Blob;
    try {
      const getWithTimeout = async (requestUrl: string, timeoutMs: number, extraHeaders?: Record<string, string>) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(requestUrl, {
            signal: controller.signal,
            ...(extraHeaders ? { headers: extraHeaders } : {}),
          });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          return null;
        }
      };

      // Use plain fetch (no timeout) for audio — mirrors the zip download path.
      // The 3-second getWithTimeout was aborting before pillows.su responded.
      // Images still get the short timeout + proxy fallback chain.
      let response: Response | null = isImage
        ? await getWithTimeout(finalUrl, 3000)
        : await fetch(finalUrl).catch(() => null);

      if (!response || !response.ok) {
        if (isImage) {
          const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(finalUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`
          ];

          for (const proxy of proxies) {
            response = await getWithTimeout(proxy, 4000);
            if (response && response.ok) break;
          }

          if (!response || !response.ok) {
             throw new Error("All proxies failed");
          }
        } else {
          throw new Error("Network error");
        }
      }

      // Guard: reject clearly non-audio/non-binary responses (HTML error pages, JSON, etc.)
      const responseCt = response.headers.get('content-type') ?? '';
      if (responseCt.startsWith('text/html') || responseCt.startsWith('application/json')) {
        throw new Error('Server returned non-audio content');
      }

      // For pillows.su, detect image vs audio from Content-Type since the URL alone doesn't distinguish them
      if (url.includes('pillows.su/f/') && response) {
        if (responseCt.startsWith('image/')) {
          isImage = true;
          // Strip any .mp3 suffix that was pre-assigned, then use image extension
          fileName = fileName.replace(/\.mp3$/i, '');
        }
      }

      blob = await response.blob();
      if (isImage) {
        blob = await compressImageBlob(blob);
        fileName = fileName.replace(/\.(png|jpeg|jpg)$/i, '') + '.jpg';
      } else {
        let actualExt = await detectAudioExt(blob);

        // If magic-byte detection fell back to .mp3, cross-check the Content-Type
        // so that FLAC/WAV/OGG files that evade byte detection still get the right ext.
        if (actualExt === '.mp3') {
          if (responseCt.includes('flac'))                                   actualExt = '.flac';
          else if (responseCt.includes('wav') || responseCt.includes('wave')) actualExt = '.wav';
          else if (responseCt.includes('aiff'))                               actualExt = '.aiff';
          else if (responseCt.includes('ogg') || responseCt.includes('opus')) actualExt = '.ogg';
          else if (responseCt.includes('m4a') || (responseCt.includes('mp4') && !responseCt.includes('video'))) actualExt = '.m4a';
        }

        // Also honour Content-Disposition filename extension when present
        const disposition = response.headers.get('content-disposition') ?? '';
        const dispExt = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/i)?.[2]
          ?.trim().match(/\.(flac|wav|aiff?|ogg|opus|m4a|zip)$/i)?.[0].toLowerCase();
        if (dispExt) actualExt = dispExt as typeof actualExt;

        // "Download as MP3": transcode any non-MP3 audio to a real MP3 so it's
        // accepted by Spotify Local Files. On failure we keep the original format.
        if (convertToMp3 && actualExt !== '.mp3') {
          try {
            blob = await blobToMp3(blob);
            actualExt = '.mp3';
          } catch (e) {
            console.warn('MP3 conversion failed, keeping original format:', e);
          }
        }

        if (actualExt !== '.mp3' && fileName.endsWith('.mp3')) {
          fileName = fileName.slice(0, -4) + actualExt;
        }

        if (meta) {
          const cleanTitle = meta.title || formatTextForNotification(suggestedName, false);
          if (actualExt === '.mp3') {
            try {
              blob = await embedID3Tags(blob, meta, cleanTitle);
            } catch (e) {
              console.warn('ID3 tagging failed, saving without tags:', e);
            }
          } else if (actualExt === '.wav') {
            try {
              blob = await embedWAVTags(blob, meta, cleanTitle);
            } catch (e) {
              console.warn('WAV tagging failed, saving without tags:', e);
            }
          } else if (actualExt === '.flac') {
            try {
              blob = await flacToWav(blob);
              actualExt = '.wav';
              fileName = fileName.replace(/\.flac$/i, '.wav');
              blob = await embedWAVTags(blob, meta, cleanTitle);
            } catch (e) {
              // decodeAudioData unsupported or failed — fall back to FLAC with embedded tags
              console.warn('[flac→wav] conversion failed, falling back to tagged FLAC:', e);
              try {
                blob = await embedFLACTags(blob, meta, cleanTitle);
              } catch (e2) {
                console.warn('[flac tags] fallback tagging also failed, saving without tags:', e2);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Download failed:', e);
      openFallback(finalUrl, fileName);
      return;
    }

    saveAs(blob, sanitizeFilename(fileName));
  } catch (e) {
    console.error('Download failed:', e);
    openFallback(finalUrl, formatTextForNotification(suggestedName, false));
  }
}

// Some sheets have viewer-downloads disabled or use hyperlinked display text
// ("Snippet", "Link", "Interview") that the CSV/gviz export strips to plain
// text, leaving no href behind. Treating that text as a playable URL sends
// window.open()/audio playback down a bogus path (e.g. window.open('Snippet')
// navigates the app to a nonexistent route), which looks like the tracker
// crashing when a song is clicked. A real link is always a full URL, a
// same-origin proxy path, or a bare audio file — anything else isn't one.
export function looksLikeRealLink(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const u = rawUrl.trim();
  return /:\/\//.test(u) || u.startsWith('/') || /\.(mp3|m4a|wav|ogg|flac|aac|mp4|mov|zip)(\?|$)/i.test(u);
}

// fileditchfiles.me sits behind a Cloudflare "Managed Challenge" that intercepts
// every request lacking a browser-solved cf_clearance cookie — an <audio> tag
// load or a server-side proxy fetch gets back the "Just a moment..." HTML page
// instead of the file, so these links can never be streamed inline. Treat them
// like any other non-embeddable host and let the UI open them in a new tab
// instead of silently failing to play.
export function isChallengeGatedAudioHost(rawUrl: string): boolean {
  return rawUrl.includes('fileditchfiles.me');
}

export function isSongNotAvailable(song: any, rawUrl: string): boolean {
  if (song.quality?.toLowerCase() === 'not available') return true;
  if (!rawUrl) return false;
  const lowerUrl = rawUrl.toLowerCase().trim();
  return lowerUrl.includes('link needed') || lowerUrl.includes('link%20needed') || lowerUrl.includes('source needed') || lowerUrl.includes('source%20needed') || lowerUrl === 'n/a';
}

export function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0;

  if (!duration.includes(':')) {
    const num = Number(duration);
    return isNaN(num) ? 0 : num;
  }

  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

export function matchesFilters(song: any, searchQuery: string, filters: any): boolean {
  const lowerQuery = searchQuery.toLowerCase();
  const searchMatch = !searchQuery ||
    (song.name || '').toLowerCase().includes(lowerQuery) ||
    (song.extra && song.extra.toLowerCase().includes(lowerQuery)) ||
    (song.description && song.description.toLowerCase().includes(lowerQuery));

  if (!searchMatch) return false;

  if (filters.tags && filters.tags.length > 0) {
    const hasAllTags = filters.tags.every((tagEmoji: string) => {
      return (song.name && song.name.includes(tagEmoji)) ||
        (song.extra && song.extra.includes(tagEmoji)) ||
        (song.fakesType && song.fakesType.toLowerCase().includes(tagEmoji.toLowerCase()));
    });

    if (!hasAllTags) {
      return false;
    }
  }

  if (filters.excludedTags && filters.excludedTags.length > 0) {
    const hasExcludedTag = filters.excludedTags.some((tagEmoji: string) => {
      return (song.name && song.name.includes(tagEmoji)) ||
        (song.extra && song.extra.includes(tagEmoji)) ||
        (song.fakesType && song.fakesType.toLowerCase().includes(tagEmoji.toLowerCase()));
    });
    if (hasExcludedTag) {
      return false;
    }
  }

  if (filters.qualities && filters.qualities.length > 0) {
    const hasAnyQuality = filters.qualities.some((quality: string) => {
      return (song.quality && song.quality.toLowerCase().includes(quality.toLowerCase())) ||
             (song.fakesLength && song.fakesLength.toLowerCase().includes(quality.toLowerCase()));
    });
    if (!hasAnyQuality) {
      return false;
    }
  }

  if (filters.excludedQualities && filters.excludedQualities.length > 0) {
    const hasExcludedQuality = filters.excludedQualities.some((quality: string) => {
      return (song.quality && song.quality.toLowerCase().includes(quality.toLowerCase())) ||
             (song.fakesLength && song.fakesLength.toLowerCase().includes(quality.toLowerCase()));
    });
    if (hasExcludedQuality) {
      return false;
    }
  }

  if (filters.availableLengths && filters.availableLengths.length > 0) {
    const hasAnyLength = filters.availableLengths.some((len: string) => {
      return song.available_length && song.available_length.toLowerCase().includes(len.toLowerCase());
    });
    if (!hasAnyLength) {
      return false;
    }
  }

  if (filters.excludedAvailableLengths && filters.excludedAvailableLengths.length > 0) {
    const hasExcludedLength = filters.excludedAvailableLengths.some((len: string) => {
      return song.available_length && song.available_length.toLowerCase().includes(len.toLowerCase());
    });
    if (hasExcludedLength) {
      return false;
    }
  }

  if (filters.durationValue && filters.durationValue.trim() !== '') {
    const songSeconds = parseDurationToSeconds(song.track_length);
    if (!songSeconds) return false;

    let targetSeconds = 0;
    if (!filters.durationValue.includes(':')) {
      const raw = Number(filters.durationValue);
      targetSeconds = !isNaN(raw) ? raw * 60 : 0;
    } else {
      targetSeconds = parseDurationToSeconds(filters.durationValue);
    }

    if (filters.durationOp === '>') {
      if (songSeconds <= targetSeconds) return false;
    } else if (filters.durationOp === '<') {
      if (songSeconds >= targetSeconds) return false;
    } else if (filters.durationOp === '=') {
      if (songSeconds !== targetSeconds) return false;
    }
  }

  if (filters.playableOnly) {
    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
    const isNotAvailable = song.quality?.toLowerCase() === 'not available';
    if (!rawUrl || (!rawUrl.includes('pillows.su/f/') && !rawUrl.includes('drive.google.com') && !rawUrl.includes('imgur.gg/f/') && !rawUrl.includes('i.imgur.com')) || isNotAvailable) {
      return false;
    }
  }

  if (filters.albums && filters.albums.length > 0) {
    const hasAnyAlbum = filters.albums.some((album: string) => {
      const songAlbum = song.extra2 || song.realEra?.name || song.extra;
      return songAlbum && songAlbum.toLowerCase() === album.toLowerCase();
    });
    if (!hasAnyAlbum) {
      return false;
    }
  }


  return true;
}
