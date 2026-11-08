import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { UserPlaylist, PlaylistSong } from './types';
import { ARTIST_LIST } from './artists/registry';
import { eraArtwork } from './eraArtwork';
import {
  GLOBAL_PLAYLISTS_KEY,
  scheduleGlobalPlaylistPush,
  initGlobalPlaylistSync,
  isSyncLoggedIn,
} from './globalPlaylistSync';

// Reserved id for the auto-built, read-only Favorites playlist. It is derived
// from every tracker's per-tracker favorites (heart button) rather than stored.
export const FAVORITES_ID = 'favorites';

interface GlobalPlaylistContextValue {
  playlists: UserPlaylist[]; // Favorites first, then user playlists
  favorites: UserPlaylist;
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, entry: PlaylistSong) => void;
  removeFromPlaylist: (playlistId: string, url: string, songName: string) => void;
  moveSong: (playlistId: string, from: number, to: number) => void;
  setCover: (id: string, cover: string) => void;
  refreshFavorites: () => void;
}

const GlobalPlaylistContext = createContext<GlobalPlaylistContextValue | null>(null);

function loadUserPlaylists(): UserPlaylist[] {
  try {
    const raw = localStorage.getItem(GLOBAL_PLAYLISTS_KEY);
    const arr = raw ? (JSON.parse(raw) as UserPlaylist[]) : [];
    return arr.filter(p => p.id !== FAVORITES_ID && !p.readonly);
  } catch {
    return [];
  }
}

// Map a localStorage favorites key ("<prefix>favorite_keys") back to its tracker
// config so a globally-aggregated favorite knows its source + artwork/artist.
function configForFavKey(key: string) {
  return ARTIST_LIST.find(c => key === `${c.STORAGE_PREFIX}favorite_keys`);
}

const MIGRATED_FLAG = 'vg_global_playlists_migrated';
const CLOUD_MIGRATED_FLAG = 'vg_global_playlists_cloud_migrated';

// Fetch the signed-in user's OLD per-tracker playlists from the account
// (aggregate `/api/sync`, grouped by tracker) and turn them into global
// playlists — so playlists a user made on another device (that only live in the
// cloud, never in this device's localStorage) also come across. Local-device
// playlists are handled separately by migrateLegacyPlaylists().
async function fetchCloudLegacyPlaylists(): Promise<UserPlaylist[]> {
  if (!isSyncLoggedIn()) return [];
  const token = localStorage.getItem('vg_token');
  try {
    const res = await fetch('/api/sync', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const byTracker = await res.json() as Record<string, { playlists?: any[] }>;
    const out: UserPlaylist[] = [];
    for (const [slug, data] of Object.entries(byTracker)) {
      const config = ARTIST_LIST.find(c => c.slug === slug);
      if (!config || !data.playlists) continue;
      for (const pl of data.playlists) {
        if (!pl?.name) continue;
        out.push({
          id: Math.random().toString(36).slice(2, 10),
          name: pl.name,
          cover: pl.cover,
          songs: (pl.songs ?? []).map((s: any) => ({
            songName: s.songName,
            eraName: s.eraName,
            url: s.url ?? '',
            tracker: config.slug,
            image: eraArtwork(config.slug, s.eraName) || config.logoUrl,
            artist: config.getArtistName(s.eraName),
          })),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Read the old per-tracker playlists (`<prefix>playlists`) from THIS device's
// localStorage, as global playlists. Pure (no side effects) so it's safe to call
// from an effect that may run twice under StrictMode; the caller owns the
// one-time flag + merge. Users keep the playlists they made before the rework.
function readLegacyLocalPlaylists(): UserPlaylist[] {
  const migrated: UserPlaylist[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.endsWith('playlists') || key === GLOBAL_PLAYLISTS_KEY) continue;
    const config = ARTIST_LIST.find(c => key === `${c.STORAGE_PREFIX}playlists`);
    if (!config) continue;
    let arr: any[] = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch { continue; }
    for (const pl of arr) {
      if (!pl?.name) continue;
      migrated.push({
        id: Math.random().toString(36).slice(2, 10),
        name: pl.name,
        cover: pl.cover,
        songs: (pl.songs ?? []).map((s: any) => ({
          songName: s.songName,
          eraName: s.eraName,
          url: s.url ?? s.song?.url ?? '',
          song: s.song,
          tracker: config.slug,
          image: eraArtwork(config.slug, s.eraName) || s.song?.image || config.logoUrl,
          artist: config.getArtistName(s.eraName),
        })),
      });
    }
  }
  return migrated;
}

// Build the derived Favorites playlist from every tracker's local favorites.
function buildLocalFavorites(): PlaylistSong[] {
  const out: PlaylistSong[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.endsWith('favorite_keys')) continue;
    const config = configForFavKey(key);
    if (!config) continue;
    let entries: any[] = [];
    try { entries = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* skip */ }
    for (const f of entries) {
      const url = f.url ?? f.song?.url ?? (f.song?.urls?.[0] ?? '');
      const dedup = `${config.slug}|${f.songName}|${url}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      out.push({
        songName: f.songName,
        eraName: f.eraName,
        url,
        tracker: config.slug,
        artist: config.getArtistName(f.eraName),
        image: eraArtwork(config.slug, f.eraName) || f.song?.image || config.logoUrl,
        song: f.song,
      });
    }
  }
  return out;
}

export function GlobalPlaylistProvider({ children }: { children: ReactNode }) {
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>(() => loadUserPlaylists());
  const [favSongs, setFavSongs] = useState<PlaylistSong[]>(() => buildLocalFavorites());

  const refreshFavorites = useCallback(() => {
    setFavSongs(buildLocalFavorites());
    // Also merge cloud favorites from other devices (aggregate endpoint) when
    // signed in, so the global Favorites list is complete across devices.
    if (!isSyncLoggedIn()) return;
    const token = localStorage.getItem('vg_token');
    fetch('/api/sync', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then((byTracker: Record<string, { favorites?: { songName: string; eraName: string; url: string }[] }> | null) => {
        if (!byTracker) return;
        setFavSongs(prev => {
          const seen = new Set(prev.map(s => `${s.tracker}|${s.songName}|${s.url}`));
          const merged = [...prev];
          for (const [slug, data] of Object.entries(byTracker)) {
            const config = ARTIST_LIST.find(c => c.slug === slug);
            if (!config || !data.favorites) continue;
            for (const f of data.favorites) {
              const dedup = `${slug}|${f.songName}|${f.url}`;
              if (seen.has(dedup)) continue;
              seen.add(dedup);
              merged.push({
                songName: f.songName,
                eraName: f.eraName,
                url: f.url,
                tracker: slug,
                artist: config.getArtistName(f.eraName),
                image: eraArtwork(slug, f.eraName) || config.logoUrl,
              });
            }
          }
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  // Persist user playlists + push to cloud on change (skip the mount write so we
  // don't push before the initial cloud pull lands).
  const mountedRef = useRef(false);
  useEffect(() => {
    localStorage.setItem(GLOBAL_PLAYLISTS_KEY, JSON.stringify(userPlaylists));
    if (mountedRef.current) scheduleGlobalPlaylistPush();
    else mountedRef.current = true;
  }, [userPlaylists]);

  // Merge a batch of migrated playlists into the store, skipping names already
  // present (dedupes across StrictMode re-runs and local vs. cloud sources).
  const mergePlaylists = useCallback((additions: UserPlaylist[]) => {
    if (!additions.length) return;
    setUserPlaylists(prev => {
      const names = new Set(prev.map(p => p.name.toLowerCase()));
      const fresh = additions.filter(p => !names.has(p.name.toLowerCase()));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  // One-time import of this device's old per-tracker playlists (localStorage).
  const tryLocalMigrate = useCallback(() => {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    const legacy = readLegacyLocalPlaylists();
    localStorage.setItem(MIGRATED_FLAG, '1');
    mergePlaylists(legacy);
  }, [mergePlaylists]);

  // One-time import of legacy per-tracker playlists from the account. Only marks
  // itself done once it actually runs while signed in, so a user who logs in
  // after load (no reload) still gets their old playlists brought over.
  const tryCloudMigrate = useCallback(async () => {
    if (localStorage.getItem(CLOUD_MIGRATED_FLAG) || !isSyncLoggedIn()) return;
    const legacy = await fetchCloudLegacyPlaylists();
    localStorage.setItem(CLOUD_MIGRATED_FLAG, '1');
    mergePlaylists(legacy);
  }, [mergePlaylists]);

  // Pull cloud playlists once on load; refresh favorites when they might change.
  useEffect(() => {
    // Import this device's legacy per-tracker playlists, then pull the global
    // store and import any legacy ones that only live in the account.
    tryLocalMigrate();
    void initGlobalPlaylistSync().then(() => tryCloudMigrate());
    const onPlaylistsSync = () => setUserPlaylists(loadUserPlaylists());
    const onDataSync = () => { refreshFavorites(); void tryCloudMigrate(); };
    const onFocus = () => refreshFavorites();
    window.addEventListener('vg-global-playlists-synced', onPlaylistsSync);
    window.addEventListener('vg-data-synced', onDataSync);
    window.addEventListener('vg-favorites-changed', onDataSync);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('vg-global-playlists-synced', onPlaylistsSync);
      window.removeEventListener('vg-data-synced', onDataSync);
      window.removeEventListener('vg-favorites-changed', onDataSync);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshFavorites, tryCloudMigrate, tryLocalMigrate]);

  const createPlaylist = (name: string): string => {
    const id = Math.random().toString(36).slice(2, 10);
    setUserPlaylists(prev => [...prev, { id, name, songs: [] }]);
    // Lets the signed-out account nudge (AccountNudge) react to a first playlist.
    setTimeout(() => window.dispatchEvent(new CustomEvent('vg-playlists-changed')), 0);
    return id;
  };
  const renamePlaylist = (id: string, name: string) => {
    if (id === FAVORITES_ID) return;
    setUserPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };
  const deletePlaylist = (id: string) => {
    if (id === FAVORITES_ID) return;
    setUserPlaylists(prev => prev.filter(p => p.id !== id));
  };
  const addToPlaylist = (playlistId: string, entry: PlaylistSong) => {
    if (playlistId === FAVORITES_ID) return;
    setUserPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      if (p.songs.some(s => s.songName === entry.songName && s.url === entry.url)) return p;
      return { ...p, songs: [...p.songs, entry] };
    }));
  };
  const removeFromPlaylist = (playlistId: string, url: string, songName: string) => {
    if (playlistId === FAVORITES_ID) return;
    setUserPlaylists(prev => prev.map(p =>
      p.id !== playlistId ? p : { ...p, songs: p.songs.filter(s => !(s.songName === songName && s.url === url)) }
    ));
  };
  const setCover = (id: string, cover: string) => {
    if (id === FAVORITES_ID) return;
    setUserPlaylists(prev => prev.map(p => p.id === id ? { ...p, cover } : p));
  };
  const moveSong = (playlistId: string, from: number, to: number) => {
    if (playlistId === FAVORITES_ID) return;
    setUserPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      const songs = [...p.songs];
      const [item] = songs.splice(from, 1);
      songs.splice(to, 0, item);
      return { ...p, songs };
    }));
  };

  const favorites: UserPlaylist = { id: FAVORITES_ID, name: 'Favorites', songs: favSongs, readonly: true };
  const playlists = [favorites, ...userPlaylists];

  return (
    <GlobalPlaylistContext.Provider value={{
      playlists, favorites, createPlaylist, renamePlaylist, deletePlaylist,
      addToPlaylist, removeFromPlaylist, moveSong, setCover, refreshFavorites,
    }}>
      {children}
    </GlobalPlaylistContext.Provider>
  );
}

export function useGlobalPlaylists() {
  const ctx = useContext(GlobalPlaylistContext);
  if (!ctx) throw new Error('useGlobalPlaylists must be used within GlobalPlaylistProvider');
  return ctx;
}
