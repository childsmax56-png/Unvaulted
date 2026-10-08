// Share cards — what a shared unvaulted.cc link looks like when it unfurls in
// Discord / X / iMessage / Reddit.
//
// buildCard() turns a page path (tracker, era, song, shared playlist, public
// profile) into the data for its card. Two consumers:
//   - functions/_middleware.ts rewrites the page's <meta> tags for link-preview
//     bots (title, description, og:image).
//   - workers/og-image renders the card as a 1200×630 PNG at /og/card.png,
//     reading this data from /api/og/card?path=… — it is never handed raw text,
//     so nobody can mint a branded card with arbitrary words on it.

import { ARTIST_REGISTRY } from '../../../src/artists/registry';
import type { ArtistConfig } from '../../../src/artists/types';

export interface Card {
  kind: 'tracker' | 'era' | 'song' | 'playlist' | 'profile';
  eyebrow: string;          // small caps label above the title
  title: string;
  subtitle: string;
  chips: string[];          // quality / availability / counts …
  rows: { name: string; sub?: string }[]; // playlist songs / top artists
  image: string | null;     // absolute cover / photo URL
  accent: string;
  description: string;      // og:description
  pageTitle: string;        // og:title
}

// Mirrors createSlug in src/utils.tsx.
export function createSlug(name: string): string {
  return encodeURIComponent(
    name.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase()
  );
}

function abs(origin: string, src: string | undefined | null): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return `${origin}${src}`;
  return null;
}

function clip(s: string, n: number): string {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

// Era name as the client shows it (App.tsx applies ERA_MAPPINGS case-insensitively).
function mapEra(cfg: ArtistConfig, name: string): string {
  const maps = (cfg as any).ERA_MAPPINGS as Record<string, string> | undefined;
  if (!maps) return name;
  const key = Object.keys(maps).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? maps[key] : name;
}

interface CatalogEra { name: string; image?: string; songs: any[] }

async function fetchCatalog(origin: string, slug: string, cfg: ArtistConfig): Promise<CatalogEra[]> {
  const res = await fetch(`${origin}/api/${slug}/a`);
  if (!res.ok) return [];
  const data = await res.json() as { eras?: Record<string, any> };
  return Object.values(data.eras ?? {}).map((era: any) => ({
    name: mapEra(cfg, String(era.name ?? '')),
    image: era.image,
    songs: Object.values(era.data ?? {}).filter(Array.isArray).flat() as any[],
  }));
}

// Mirrors getSongSlug in src/utils.tsx.
function songSlug(song: any, all: any[]): string {
  if (!song?.name) return 'NoName1';
  const unnamed = (s: any) => (s.name && s.name.includes('???')) || createSlug(s.name || '') === '';
  if (!unnamed(song)) return createSlug(song.name) || 'NoName1';
  const target = song.url || song.urls?.[0] || '';
  let index = 1;
  for (const s of all) {
    if (!unnamed(s)) continue;
    if (s.name === song.name && (s.url || s.urls?.[0] || '') === target && s.description === song.description) return `NoName${index}`;
    index++;
  }
  return 'NoName1';
}

const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;

function trackerCard(origin: string, cfg: ArtistConfig, eras: CatalogEra[]): Card {
  const songs = eras.reduce((n, e) => n + e.songs.length, 0);
  const chips = eras.length ? [plural(eras.length, 'era'), plural(songs, 'song')] : [];
  return {
    kind: 'tracker',
    eyebrow: 'Unreleased music tracker',
    title: cfg.artistLabel,
    subtitle: 'Every leak, snippet and unreleased song in one place',
    chips,
    rows: [],
    image: abs(origin, cfg.artistPhotoUrl || cfg.logoUrl),
    accent: cfg.accentColor,
    description: `${cfg.artistLabel} tracker on UNVAULTED${chips.length ? ` — ${chips.join(', ')}` : ''}. Stream unreleased songs, snippets and leaks.`,
    pageTitle: `${cfg.artistLabel} Tracker · UNVAULTED`,
  };
}

async function artistCard(origin: string, slug: string, rest: string[], search: URLSearchParams): Promise<Card | null> {
  const cfg = ARTIST_REGISTRY[slug];
  if (!cfg || cfg.hidden) return null;
  const eras = await fetchCatalog(origin, slug, cfg);

  // /{slug}/album/{era} or /{slug}/related/{era}
  if ((rest[0] === 'album' || rest[0] === 'related') && rest[1]) {
    const want = decodeURIComponent(rest[1]).toLowerCase();
    const era = eras.find((e) => decodeURIComponent(createSlug(e.name)).toLowerCase() === want);
    if (!era) return trackerCard(origin, cfg, eras);
    const cover = abs(origin, cfg.CUSTOM_IMAGES?.[era.name] || era.image) ?? abs(origin, cfg.artistPhotoUrl || cfg.logoUrl);
    const release = cfg.ALBUM_RELEASE_DATES?.[era.name];

    const songParam = search.get('song');
    const song = songParam ? era.songs.find((s) => songSlug(s, era.songs) === songParam) : null;
    if (song) {
      const chips = [song.available_length, song.quality, song.track_length]
        .map((x: unknown) => String(x ?? '').trim())
        .filter((x: string) => x && x.toLowerCase() !== 'n/a');
      const leak = String(song.leak_date ?? '').trim();
      if (leak && !leak.includes('?')) chips.push(`Leaked ${leak}`);
      const desc = clip(String(song.description ?? ''), 220);
      return {
        kind: 'song',
        eyebrow: `${cfg.artistLabel} · Unreleased`,
        title: clip(song.name, 80),
        subtitle: clip([era.name, song.extra].filter(Boolean).join(' · '), 110),
        chips: chips.slice(0, 4),
        rows: [],
        image: cover,
        accent: cfg.accentColor,
        description: desc || `${song.name} by ${cfg.artistLabel} (${era.name}). ${chips.join(' · ')}`,
        pageTitle: `${song.name} — ${cfg.artistLabel} · UNVAULTED`,
      };
    }

    const chips = [plural(era.songs.length, 'song')];
    if (release && !release.includes('?')) chips.push(release);
    const desc = clip(String(cfg.ALBUM_DESCRIPTIONS?.[era.name] ?? ''), 220);
    return {
      kind: 'era',
      eyebrow: `${cfg.artistLabel} · Era`,
      title: clip(era.name, 70),
      subtitle: desc ? clip(desc, 120) : `${era.songs.length} unreleased songs, snippets and leaks`,
      chips,
      rows: [],
      image: cover,
      accent: cfg.accentColor,
      description: desc || `${era.name} by ${cfg.artistLabel} — ${chips.join(' · ')}`,
      pageTitle: `${era.name} — ${cfg.artistLabel} · UNVAULTED`,
    };
  }
  return trackerCard(origin, cfg, eras);
}

interface SharedPlaylist { name: string; cover?: string; songs: { songName: string; eraName?: string; tracker?: string; image?: string; artist?: string }[] }

function playlistCard(origin: string, encoded: string): Card | null {
  let data: SharedPlaylist;
  try {
    // Mirrors decodeShared in src/PlaylistsPage.tsx (search params arrive already URL-decoded once).
    data = JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    try { data = JSON.parse(decodeURIComponent(atob(decodeURIComponent(encoded)))); } catch { return null; }
  }
  if (!data || typeof data.name !== 'string' || !Array.isArray(data.songs)) return null;
  const first = data.songs.find((s) => s.image);
  const artistOf = (s: SharedPlaylist['songs'][number]) => s.artist || (s.tracker ? ARTIST_REGISTRY[s.tracker]?.artistLabel : '') || '';
  const artists = [...new Set(data.songs.map(artistOf).filter(Boolean))];
  return {
    kind: 'playlist',
    eyebrow: 'Playlist',
    title: clip(data.name, 70),
    subtitle: artists.length ? clip(artists.slice(0, 4).join(', ') + (artists.length > 4 ? ` & ${artists.length - 4} more` : ''), 110) : '',
    chips: [plural(data.songs.length, 'song')],
    rows: data.songs.slice(0, 4).map((s) => ({ name: clip(s.songName, 48), sub: clip([artistOf(s), s.eraName].filter(Boolean).join(' · '), 60) })),
    image: abs(origin, data.cover && !data.cover.startsWith('data:') ? data.cover : first?.image),
    accent: '#F43F5E',
    description: `${data.songs.length} songs${artists.length ? ` from ${artists.slice(0, 5).join(', ')}` : ''}. Open it on UNVAULTED to listen or add it to your playlists.`,
    pageTitle: `${data.name} · UNVAULTED playlist`,
  };
}

async function profileCard(origin: string, username: string): Promise<Card | null> {
  const res = await fetch(`${origin}/api/users/${encodeURIComponent(username)}`);
  if (!res.ok) return null;
  const p = await res.json() as any;
  const listening = p.listening;
  const rows: Card['rows'] = [];
  const chips: string[] = [];
  if (listening && !p.private && !listening.hidden) {
    for (const t of (listening.topTrackers ?? []).slice(0, 4)) {
      const label = ARTIST_REGISTRY[t.artistSlug]?.artistLabel || t.artistSlug;
      rows.push({ name: label, sub: plural(t.plays, 'play') });
    }
    if (listening.plays) chips.push(`${plural(listening.plays, 'play')} · last ${listening.days ?? 30} days`);
    const mins = Number(listening.minutes) || 0;
    if (mins) chips.push(mins >= 120 ? `${Math.round(mins / 60).toLocaleString('en-US')} hours` : `${mins} min`);
  }
  return {
    kind: 'profile',
    eyebrow: rows.length ? 'Listening stats' : 'Profile',
    title: clip(p.username, 40),
    subtitle: rows.length ? 'Top artists this month' : 'on UNVAULTED',
    chips,
    rows,
    image: abs(origin, p.avatarUrl),
    accent: '#7C5CFF',
    description: rows.length
      ? `${p.username}'s top artists: ${rows.map((r) => r.name).join(', ')}.`
      : `${p.username} on UNVAULTED.`,
    pageTitle: `${p.username} · UNVAULTED`,
  };
}

// path may include a query string (e.g. "/vampgold/album/x?song=y").
export async function buildCard(origin: string, pathAndQuery: string): Promise<Card | null> {
  let url: URL;
  try { url = new URL(pathAndQuery, origin); } catch { return null; }
  if (url.origin !== origin) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const [first, ...rest] = parts;
  if (first === 'playlists') {
    const shared = url.searchParams.get('shared');
    return shared ? playlistCard(origin, shared) : null;
  }
  if (first === 'u' && rest[0]) return profileCard(origin, decodeURIComponent(rest[0]));
  return artistCard(origin, first, rest, url.searchParams);
}
