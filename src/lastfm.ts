const LASTFM_SESSION_KEY = 'lastfm_session_key';
const LASTFM_USERNAME_KEY = 'lastfm_username';

import { getArtistName, TAG_MAP } from './utils';

export function getLastfmSession(): string | null {
  return localStorage.getItem(LASTFM_SESSION_KEY);
}

export function getLastfmUsername(): string | null {
  return localStorage.getItem(LASTFM_USERNAME_KEY);
}

export function isLastfmLoggedIn(): boolean {
  return !!getLastfmSession();
}

export function saveLastfmSession(sessionKey: string, username: string) {
  localStorage.setItem(LASTFM_SESSION_KEY, sessionKey);
  localStorage.setItem(LASTFM_USERNAME_KEY, username);
}

export function clearLastfmSession() {
  localStorage.removeItem(LASTFM_SESSION_KEY);
  localStorage.removeItem(LASTFM_USERNAME_KEY);
}

export function startLastfmAuth() {
  window.open('/api/lastfm/auth', '_blank', 'width=600,height=700');
}

const STRIP_EMOJIS = Object.keys(TAG_MAP);

export function cleanTrackName(name: string, extra?: string, showVersion: boolean = true, showTags: boolean = false, showMoreInfo: boolean = true): string {
  let clean = name;

  if (clean.includes(' - ')) {
    clean = clean.split(' - ').slice(1).join(' - ').trim();
  }

  if (!showVersion) {
    clean = clean.replace(/\s*\[V\d+.*?\]/gi, '');
  }

  Object.entries(TAG_MAP).forEach(([emoji, tag]) => {
    if (clean.includes(emoji)) {
      if (showTags) {
        clean = clean.replaceAll(emoji, '').trim() + ` [${tag.toUpperCase()}]`;
      } else {
        clean = clean.replaceAll(emoji, '').trim();
      }
    }
  });

  if (showMoreInfo) {
    if (extra && !clean.includes(extra)) {
      clean = `${clean} ${extra}`;
    }
  } else {
    clean = clean.replace(/\s*\([^)]*\)/g, '');
  }

  return clean.replace(/\s+/g, ' ').trim();
}

export function cleanAlbumName(albumName: string): string {
  if (!albumName) return '';
  return albumName
    .replace(/\s*\[.*?\]\s*/g, ' ')
    .replace(/\s*\(\d{4}\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseArtistFromSong(songName: string, _extra?: string, eraName?: string): string {
  let artist = '';
  const parts = songName.split(' - ');
  if (parts.length > 1) {
    artist = parts[0].trim();
  } else {
    artist = getArtistName(eraName);
  }

  for (const emoji of STRIP_EMOJIS) {
    artist = artist.replaceAll(emoji, '');
  }
  return artist.trim();
}

// Swaps a parsed artist for the user's chosen Last.fm artist name (set from an
// era header or Settings). Matches the exact name first, then case-insensitively.
export function applyLastfmArtistOverride(artist: string, overrides: Record<string, string> | undefined): string {
  if (!overrides || !artist) return artist;
  if (overrides[artist]) return overrides[artist];
  const lower = artist.toLowerCase();
  const key = Object.keys(overrides).find(k => k.toLowerCase() === lower);
  return key ? overrides[key] : artist;
}

export async function handleLastfmCallback(token: string): Promise<{ success: boolean; username?: string }> {
  try {
    const response = await fetch(`/api/lastfm/callback?token=${encodeURIComponent(token)}`);
    const data = await response.json();

    if (data.session) {
      saveLastfmSession(data.session.key, data.session.name);
      return { success: true, username: data.session.name };
    }
    return { success: false };
  } catch (error) {
    console.error('Last.fm callback error:', error);
    return { success: false };
  }
}

export async function scrobbleTrack(
  track: string,
  artist: string,
  album: string,
  timestamp: number,
  duration?: number
): Promise<boolean> {
  const sessionKey = getLastfmSession();
  if (!sessionKey) return false;

  try {
    const response = await fetch('/api/lastfm/scrobble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track,
        artist,
        album,
        timestamp,
        duration,
        sk: sessionKey,
      }),
    });

    if (response.status === 404 || response.status >= 500) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lastfm-api-error'));
      return false;
    }

    const data = await response.json();
    if (data.error) {
      console.error('Scrobble error:', data.error);
      if (data.error === 9) {
        clearLastfmSession();
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error('Scrobble failed:', error);
    return false;
  }
}

export async function updateNowPlaying(
  track: string,
  artist: string,
  album: string,
  duration?: number
): Promise<boolean> {
  const sessionKey = getLastfmSession();
  if (!sessionKey) return false;

  try {
    const response = await fetch('/api/lastfm/nowplaying', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track,
        artist,
        album,
        duration,
        sk: sessionKey,
      }),
    });

    if (response.status === 404 || response.status >= 500) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lastfm-api-error'));
      return false;
    }

    const data = await response.json();
    if (data.error) {
      console.error('Now playing error:', data.error);
      if (data.error === 9) {
        clearLastfmSession();
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error('Now playing failed:', error);
    return false;
  }
}
