// Shared helpers for the community-tracker system: schema bootstrap, slug rules,
// link-host validation, and row types. All community endpoints import from here.
//
// Storage lives in the same D1 database as the account system (the DB binding).
// Tables are created lazily with CREATE TABLE IF NOT EXISTS — mirroring the
// yeditsgold pattern in ../_yedits-auth.ts — so there is no separate migration.
import { ARTIST_REGISTRY } from '../../../src/artists/registry';
import { getAuthUser, isYeditsAdmin, type VGAuthUser } from '../_yedits-auth';

export interface CommunityTrackerRow {
  id: string;
  slug: string;
  user_id: string;
  username: string;
  name: string;
  description: string | null;
  accent_color: string | null;
  logo_url: string | null;
  artist_photo_url: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'removed';
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityEraRow {
  id: string;
  tracker_id: string;
  name: string;
  image: string | null;
  release_date: string | null;
  description: string | null;
  sort_order: number;
}

export interface CommunitySongRow {
  id: string;
  era_id: string;
  tracker_id: string;
  category: string;
  name: string;
  extra: string | null;
  notes: string | null;
  credited: string | null;
  quality: string | null;
  available_length: string | null;
  track_length: string | null;
  leak_date: string | null;
  file_date: string | null;
  url: string | null;
  tab: string;
  sort_order: number;
}

// Content types an entry can live under. 'unreleased' is the default (Music tab);
// 'released' takes a streaming link, 'stems' an audio link, 'art' an image.
export const SONG_TABS = ['unreleased', 'released', 'stems', 'art'] as const;

export async function ensureCommunityTables(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS community_trackers (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        accent_color TEXT,
        logo_url TEXT,
        artist_photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        submitted_at TEXT,
        reviewed_at TEXT,
        reviewed_by TEXT,
        review_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS community_eras (
        id TEXT PRIMARY KEY,
        tracker_id TEXT NOT NULL,
        name TEXT NOT NULL,
        image TEXT,
        release_date TEXT,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE(tracker_id, name)
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS community_songs (
        id TEXT PRIMARY KEY,
        era_id TEXT NOT NULL,
        tracker_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Unreleased Tracks',
        name TEXT NOT NULL,
        extra TEXT,
        notes TEXT,
        credited TEXT,
        quality TEXT,
        available_length TEXT,
        track_length TEXT,
        leak_date TEXT,
        file_date TEXT,
        url TEXT,
        tab TEXT NOT NULL DEFAULT 'unreleased',
        sort_order INTEGER NOT NULL DEFAULT 0
      )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_community_eras_tracker ON community_eras(tracker_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_community_songs_tracker_tab ON community_songs(tracker_id, tab)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_community_songs_era ON community_songs(era_id)`),
  ]);
}

// Route words and API prefixes a community slug must never shadow.
export const RESERVED_SLUGS = new Set([
  'api', 'community', 'create-tracker', 'my-tracker', 'listening', 'game',
  'tierlist', 'tier-list', 'terms', 'privacy', 'download', 'yeditsgold',
  'yedits', 'settings', 'login', 'register', 'admin', 'auth', 'logos',
  'data', 'assets', 'public', 'feed', 'search', 'about', 'help', 'archive',
  'changes', 'alerts', 'rooms', 'producers', 'playlists', 'foryou', 'guess', 'u',
]);

// URL-safe slug: lowercase letters, digits and single hyphens, 3–40 chars.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlugFormat(slug: string): string | null {
  if (!slug) return 'Slug is required';
  if (slug.length < 3) return 'Slug must be at least 3 characters';
  if (slug.length > 40) return 'Slug must be 40 characters or fewer';
  if (!SLUG_RE.test(slug)) return 'Slug may only contain lowercase letters, numbers and hyphens';
  return null;
}

// True when `slug` is free to claim: valid format, not reserved, not an official
// tracker, and not already used by another community tracker.
export async function isSlugAvailable(db: D1Database, slug: string): Promise<{ ok: boolean; reason?: string }> {
  const fmt = validateSlugFormat(slug);
  if (fmt) return { ok: false, reason: fmt };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'That slug is reserved' };
  if (slug in ARTIST_REGISTRY) return { ok: false, reason: 'That slug belongs to an official tracker' };
  const existing = await db.prepare('SELECT id FROM community_trackers WHERE slug = ?').bind(slug).first();
  if (existing) return { ok: false, reason: 'That slug is already taken' };
  return { ok: true };
}

// Hosts allowed for downloadable audio (unreleased music + stems). Users host
// the audio elsewhere and link it — we never store audio files.
const AUDIO_HOST_RE = [
  /(^|\.)pillowcase\.su$/i,
  /(^|\.)pillows\.su$/i,
  /(^|\.)pixeldrain\.com$/i,
  /(^|\.)pixeldrain\.net$/i,
  /(^|\.)imgur\.com$/i,
  /(^|\.)krakenfiles\.com$/i,
  /(^|\.)music\.froste\.lol$/i,
];

// Streaming platforms allowed for the Released tab.
const STREAMING_HOST_RE = [
  /(^|\.)spotify\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)music\.apple\.com$/i,
  /(^|\.)apple\.co$/i,
  /(^|\.)soundcloud\.com$/i,
  /(^|\.)tidal\.com$/i,
  /(^|\.)deezer\.com$/i,
  /(^|\.)audiomack\.com$/i,
  /(^|\.)bandcamp\.com$/i,
];

// Image hosts allowed for covers/logos/art (in addition to our own uploads).
const IMAGE_HOST_RE = [
  /(^|\.)imgur\.com$/i,
  /(^|\.)i\.ibb\.co$/i,
  /(^|\.)ibb\.co$/i,
  /(^|\.)pixeldrain\.com$/i,
];

function hostOf(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}

// Images may also be our own hosted uploads (relative /api/community/image URL).
function isOwnHostedImage(url: string): boolean {
  return url.startsWith('/api/community/image');
}

// Each validator treats an empty value as valid — links are optional.
export function isAllowedImage(raw: string | null | undefined): boolean {
  const url = (raw ?? '').trim();
  if (!url) return true;
  if (isOwnHostedImage(url)) return true;
  const host = hostOf(url);
  return !!host && IMAGE_HOST_RE.some((re) => re.test(host));
}

export function isAllowedAudio(raw: string | null | undefined): boolean {
  const url = (raw ?? '').trim();
  if (!url) return true;
  const host = hostOf(url);
  return !!host && AUDIO_HOST_RE.some((re) => re.test(host));
}

export function isAllowedStreaming(raw: string | null | undefined): boolean {
  const url = (raw ?? '').trim();
  if (!url) return true;
  const host = hostOf(url);
  return !!host && STREAMING_HOST_RE.some((re) => re.test(host));
}

// Validate a song's link against the content type of its tab: art wants an
// image, released wants a streaming link, unreleased/stems want audio.
export function isAllowedSongLink(raw: string | null | undefined, tab: string): boolean {
  if (tab === 'art') return isAllowedImage(raw);
  if (tab === 'released') return isAllowedStreaming(raw);
  return isAllowedAudio(raw);
}

// Backwards-compatible alias — image/cover fields validate as images.
export const isAllowedLink = isAllowedImage;

export function genId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Extract the bearer token from an Authorization header, or null.
export function bearer(request: Request): string | null {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Resolve the signed-in account from the request's bearer token, or null.
export async function resolveUser(request: Request): Promise<VGAuthUser | null> {
  const token = bearer(request);
  if (!token) return null;
  return getAuthUser(token);
}

// Site owner or a yeditsgold admin — the same moderator pool that reviews yedits.
export async function canModerate(db: D1Database, user: VGAuthUser): Promise<boolean> {
  return isYeditsAdmin(db, user.id, user.email);
}

// A user may edit a tracker if they created it or they are a moderator.
export async function canEditTracker(db: D1Database, tracker: CommunityTrackerRow, user: VGAuthUser): Promise<boolean> {
  if (tracker.user_id === user.id) return true;
  return canModerate(db, user);
}

export type { VGAuthUser };
