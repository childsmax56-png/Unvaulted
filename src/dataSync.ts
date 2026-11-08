// Cloud sync for favorites + playlists.
//
// Backing store is the per-tracker `GET/PUT /api/sync/{tracker_id}` endpoint
// (functions/api/sync/[tracker_id].ts), which reads/writes the D1 `favorites`,
// `playlists`, and `playlist_songs` tables scoped to the signed-in user. Calls
// are same-origin: whatever deployment serves the app handles them, and every
// deployment binds the same D1, so a session token round-trips across origins
// (matches src/listening.ts).
//
// Local state stays the source of truth for the UI; this module mirrors it up
// on change (debounced) and pulls it down on load so a signed-in user sees the
// same favorites/playlists on any device.
import { activeConfig } from './artists/activeConfig';

const VG_API = '';
const TOKEN_KEY = 'vg_token';
const PUSH_DEBOUNCE_MS = 1200;

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isSyncLoggedIn(): boolean {
  return !!getToken();
}

// Read per-artist keys at call time — activeConfig is a singleton mutated by
// ArtistRoute before each artist mounts.
function trackerId(): string {
  return activeConfig.slug;
}
function favKey(): string {
  return `${activeConfig.STORAGE_PREFIX}favorite_keys`;
}
function playlistKey(): string {
  return `${activeConfig.STORAGE_PREFIX}playlists`;
}

interface SyncSong { songName: string; eraName: string; url: string }
interface SyncPlaylist { id?: string; name: string; cover?: string; songs: SyncSong[] }
interface SyncPayload { favorites: SyncSong[]; playlists: SyncPlaylist[] }

// `pulled` gates pushing: we never overwrite the account with local state until
// a pull has populated it this session, so a fresh device can't wipe cloud data
// with its empty localStorage. Keyed by token+tracker so switching accounts in
// the same page load (sign out → sign in, no reload) is treated as un-pulled,
// blocking a push until the new account's own data is fetched.
const pulled = new Set<string>();
const lastSnapshot = new Map<string, string>();
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function stateKey(id: string): string {
  return `${getToken() ?? ''}:${id}`;
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function readLocalPayload(): SyncPayload {
  const favorites = parse<any[]>(localStorage.getItem(favKey()), []);
  const playlists = parse<any[]>(localStorage.getItem(playlistKey()), []);
  return {
    favorites: favorites.map(f => ({ songName: f.songName, eraName: f.eraName, url: f.url ?? '' })),
    playlists: playlists.map(p => ({
      id: p.id,
      name: p.name,
      cover: p.cover,
      songs: (p.songs ?? []).map((s: any) => ({ songName: s.songName, eraName: s.eraName, url: s.url ?? '' })),
    })),
  };
}

async function pushNow(id: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  const key = stateKey(id);
  // Only push once we've confirmed this account's cloud state for this tracker.
  if (!pulled.has(key)) return;
  const snapshot = JSON.stringify(readLocalPayload());
  if (lastSnapshot.get(key) === snapshot) return; // nothing changed since last sync
  try {
    const res = await fetch(`${VG_API}/api/sync/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: snapshot,
    });
    if (res.ok) lastSnapshot.set(key, snapshot);
  } catch {
    // Best-effort: a failed push retries on the next local change.
  }
}

// Debounced push of the current tracker's favorites + playlists. Captures the
// tracker id at schedule time so navigating away mid-debounce still targets the
// right tracker.
export function scheduleDataPush(): void {
  if (!isSyncLoggedIn()) return;
  const id = trackerId();
  const existing = pushTimers.get(id);
  if (existing) clearTimeout(existing);
  pushTimers.set(id, setTimeout(() => {
    pushTimers.delete(id);
    void pushNow(id);
  }, PUSH_DEBOUNCE_MS));
}

// Which account this browser's local favorites/playlists for a tracker were last
// reconciled with. Until a tracker has been reconciled with the signed-in
// account, the local data is guest data (saved before signing in or signing
// up), so we merge it into the account instead of overwriting it with the
// cloud copy, which is empty for a brand-new account.
const OWNER_PREFIX = 'vg_sync_owner_';

function currentUserId(): string | null {
  try {
    const u = JSON.parse(localStorage.getItem('vg_user') || 'null') as { id?: string } | null;
    return u?.id ?? getToken();
  } catch {
    return getToken();
  }
}

const songKey = (s: SyncSong) => `${s.eraName}\u0000${s.songName}`;

// Write one tracker's cloud favorites/playlists into localStorage under
// `prefix`. The first time this browser sees that tracker for this account,
// local-only favorites and playlists are kept and pushed up to the account.
// After that the cloud copy wins, so deletes made on other devices stick.
// Shared with the manual "sync all trackers" buttons.
export function applyCloudTrackerData(
  id: string,
  prefix: string,
  cloud: { favorites?: SyncSong[]; playlists?: SyncPlaylist[] },
): void {
  const cloudFavs = cloud.favorites ?? [];
  const cloudPls = cloud.playlists ?? [];
  const favStorageKey = `${prefix}favorite_keys`;
  const plStorageKey = `${prefix}playlists`;
  const userId = currentUserId();
  const ownerKey = OWNER_PREFIX + id;

  let favorites: SyncSong[] = cloudFavs;
  let playlists: SyncPlaylist[] = cloudPls;
  let addedLocal = false;

  if (userId && localStorage.getItem(ownerKey) !== userId) {
    const localFavs = parse<any[]>(localStorage.getItem(favStorageKey), []);
    const localPls = parse<any[]>(localStorage.getItem(plStorageKey), []);
    const seen = new Set(cloudFavs.map(songKey));
    const extraFavs = localFavs
      .map(f => ({ songName: f.songName, eraName: f.eraName, url: f.url ?? '' }))
      .filter(f => f.songName && !seen.has(songKey(f)));
    const plNames = new Set(cloudPls.map(p => p.name.toLowerCase()));
    const extraPls = localPls.filter(p => p?.name && !plNames.has(String(p.name).toLowerCase()));
    if (extraFavs.length || extraPls.length) {
      favorites = [...cloudFavs, ...extraFavs];
      playlists = [...cloudPls, ...extraPls];
      addedLocal = true;
    }
    localStorage.setItem(ownerKey, userId);
  }

  localStorage.setItem(favStorageKey, JSON.stringify(favorites));
  localStorage.setItem(plStorageKey, JSON.stringify(playlists));

  const token = getToken();
  if (addedLocal && token) {
    const body = JSON.stringify({
      favorites,
      playlists: playlists.map(p => ({
        id: p.id, name: p.name, cover: p.cover,
        songs: (p.songs ?? []).map((s: any) => ({ songName: s.songName, eraName: s.eraName, url: s.url ?? '' })),
      })),
    });
    void fetch(`${VG_API}/api/sync/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    }).catch(() => {});
  }
}

// Pull the current tracker's cloud data into localStorage and notify the app.
export async function pullDataSync(): Promise<void> {
  const token = getToken();
  if (!token) return;
  const id = trackerId();
  try {
    const res = await fetch(`${VG_API}/api/sync/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json() as { favorites?: SyncSong[]; playlists?: SyncPlaylist[] };
    applyCloudTrackerData(id, activeConfig.STORAGE_PREFIX, data);
    pulled.add(stateKey(id));
    lastSnapshot.set(stateKey(id), JSON.stringify(readLocalPayload()));
    // App.tsx + PlaylistContext refresh their in-memory state off this event.
    window.dispatchEvent(new CustomEvent('vg-data-synced'));
  } catch {
    // Best-effort: leave local state untouched on failure.
  }
}

// The manual "sync" buttons (LandingPage / VaultGoldSection) pull every tracker
// at once and dispatch 'vg-data-synced' without going through pullDataSync. Mark
// the current tracker as pulled when that happens so pushes aren't blocked, and
// re-baseline the snapshot to the freshly-pulled data.
let listenersInstalled = false;
function installListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  window.addEventListener('vg-data-synced', () => {
    if (!isSyncLoggedIn()) return;
    pulled.add(stateKey(trackerId()));
    lastSnapshot.set(stateKey(trackerId()), JSON.stringify(readLocalPayload()));
  });
}

// Run on app load and on artist change: pull this tracker's cloud data once per
// session so favorites/playlists show up on a device that never made them.
export async function initDataSync(): Promise<void> {
  installListeners();
  if (!isSyncLoggedIn()) return;
  if (pulled.has(stateKey(trackerId()))) return;
  await pullDataSync();
}
