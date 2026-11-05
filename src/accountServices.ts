// Shared UNVAULTED-account ↔ streaming-service helpers, used by the Settings
// account section and the Spotify link banner on the Unreleased tab.

export const ACCOUNT_API = 'https://unvaulted.cc';

export interface LinkedServices {
  spotify?: { access_token: string; refresh_token: string; expires_at: number; username: string | null };
  lastfm?: { session_key: string; username: string | null };
}

export function getAccountToken(): string | null {
  try { return localStorage.getItem('vg_token'); } catch { return null; }
}

// Returns null when signed out or the request fails.
export async function fetchLinkedServices(): Promise<LinkedServices | null> {
  const token = getAccountToken();
  if (!token) return null;
  const res = await fetch(`${ACCOUNT_API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.linked ?? {};
}

// Sends the user through Spotify OAuth; the callback stores the tokens on
// their account and redirects back here with ?vg_spotify_linked=1.
export function startSpotifyAccountLink(): void {
  const token = getAccountToken();
  if (!token) return;
  const returnTo = window.location.href.split('?')[0];
  window.location.href = `${ACCOUNT_API}/api/auth/spotify/connect?token=${encodeURIComponent(token)}&return_to=${encodeURIComponent(returnTo)}`;
}

// Copies account-linked service credentials into this browser's localStorage.
// Returns the services synced, or spotifyExpired when the stored Spotify
// session is too old to use (the user needs to re-link).
export function applyLinkedServices(l: LinkedServices): { synced: string[]; spotifyExpired: boolean } {
  const synced: string[] = [];
  const spotifyExpired = !!(l.spotify?.expires_at && Date.now() > l.spotify.expires_at - 30 * 1000);
  if (l.spotify?.access_token && !spotifyExpired) {
    localStorage.setItem('spotify_access_token', l.spotify.access_token);
    localStorage.setItem('spotify_refresh_token', l.spotify.refresh_token);
    localStorage.setItem('spotify_expires_at', String(l.spotify.expires_at));
    synced.push('Spotify');
  }
  if (spotifyExpired) return { synced, spotifyExpired };
  if (l.lastfm?.session_key) {
    localStorage.setItem('lastfm_session_key', l.lastfm.session_key);
    if (l.lastfm.username) localStorage.setItem('lastfm_username', l.lastfm.username);
    synced.push('Last.fm');
  }
  return { synced, spotifyExpired };
}
