import { useState, useEffect } from 'react';
import axios from 'axios';
import { Song, Era } from './types';
import { parseArtistFromSong } from './lastfm';
import { getArtistName } from './utils';

export interface Annotation {
  fragment: string;
  body: string;
}

export interface SongInfo {
  description: string | null;
  producers: string[];
  writers: string[];
  samples: { title: string; artist: string }[];
  annotationCount: number;
}

export interface LyricsData {
  plainLyrics: string | null;
  syncedLyrics: string | null;
  parsedSyncedLyrics: { time: number; text: string }[] | null;
  source: 'lrclib' | null;
  annotations: Annotation[] | null;
  geniusUrl: string | null;
  songInfo: SongInfo | null;
}

type GeniusInfo = Pick<LyricsData, 'annotations' | 'geniusUrl' | 'songInfo'>;

// Lyrics text (lrclib) and song info (Genius API) are looked up independently;
// the cache keeps each one's result (null = not found).
const lyricsCache = new Map<string, { lrclib: LyricsData | null; genius: GeniusInfo | null }>();

function cleanTrackName(name: string): string {
  let track = name;
  if (track.includes(' - ')) {
    track = track.split(' - ').slice(1).join(' - ').trim();
  }

  track = track.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '');

  track = track.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');

  return track.trim();
}

function getAlternativeNames(song: Song): string[] {
  const names: string[] = [];

  const baseTrackName = cleanTrackName(song.name);
  if (baseTrackName) names.push(baseTrackName);

  const processText = (text: string | undefined) => {
    if (!text) return;

    const parenMatches = [...text.matchAll(/\(([^)]+)\)/g)];
    for (const match of parenMatches) {
      const inner = match[1];
      const lowerInner = inner.toLowerCase().trim();
      if (lowerInner.startsWith('prod') || lowerInner.startsWith('feat') || lowerInner.startsWith('ft') || lowerInner.startsWith('ref') || lowerInner === 'snippet') {
        continue;
      }

      const parts = inner.split(/[,/]/);
      for (let part of parts) {
        part = part.trim();
        part = part.replace(/\s*'\s*/g, "'");
        part = cleanTrackName(part);
        if (part) names.push(part);
      }
    }

    let textWithoutParens = text.replace(/\([^)]+\)/g, '').trim();
    if (textWithoutParens) {
      const parts = textWithoutParens.split(/[,/]/);
      for (let part of parts) {
        part = part.trim();
        const lowerPart = part.toLowerCase();
        if (lowerPart.startsWith('prod') || lowerPart.startsWith('feat') || lowerPart.startsWith('ft') || lowerPart.startsWith('ref')) {
          continue;
        }
        part = part.replace(/\s*'\s*/g, "'");
        part = cleanTrackName(part);
        if (part) names.push(part);
      }
    }
  };

  processText(song.name);
  processText(song.extra);

  const lower = baseTrackName.toLowerCase();
  if (lower.includes('see me') || lower.includes('see you again') || lower.includes('never see me again')) {
    names.push('Never See Me Again', 'See You Again', 'See Me Again', 'See Me');
  }
  if (lower.includes("mama's boy") || lower.includes("mamas boy")) {
    names.push("Mama's Boyfriend", "My Momma's Boyfriend");
  }

  return [...new Set(names)];
}


function parseSyncedLyrics(synced: string): { time: number; text: string }[] {
  return synced.split('\n').map((line: string) => {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (!match) return null;
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const msStr = match[3];
    const milliseconds = msStr.length === 2 ? parseInt(msStr, 10) * 10 : parseInt(msStr, 10);
    return { time: minutes * 60 + seconds + milliseconds / 1000, text: match[4].trim() };
  }).filter(Boolean) as { time: number; text: string }[];
}

// Genius gives song info + annotations only (see functions/api/lyrics.ts); lyrics text is lrclib's.
async function fetchGeniusInfo(artists: string[], tracks: string[], alive: () => boolean): Promise<GeniusInfo | null> {
  for (const artist of artists) {
    for (const track of tracks) {
      if (!alive()) return null;
      try {
        const res = await axios.get('/api/lyrics', { params: { artist, track } });
        if (res.data?.geniusUrl) {
          return {
            annotations: res.data.annotations ?? null,
            geniusUrl: res.data.geniusUrl,
            songInfo: res.data.songInfo ?? null,
          };
        }
      } catch {
        // Genius unreachable — continue trying
      }
    }
  }
  return null;
}

async function fetchLrclib(artists: string[], tracks: string[], alive: () => boolean): Promise<LyricsData | null> {
  for (const artist of artists) {
    for (const track of tracks) {
      if (!alive()) return null;
      try {
        const res = await axios.get('https://lrclib.net/api/get', { params: { artist_name: artist, track_name: track } });
        if (res.data && (res.data.plainLyrics || res.data.syncedLyrics)) {
          return {
            plainLyrics: res.data.plainLyrics || null,
            syncedLyrics: res.data.syncedLyrics ? res.data.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]\s*/g, '') : null,
            parsedSyncedLyrics: res.data.syncedLyrics ? parseSyncedLyrics(res.data.syncedLyrics) : null,
            source: 'lrclib',
            annotations: null,
            geniusUrl: null,
            songInfo: null,
          };
        }
      } catch {
      }
    }
  }
  return null;
}

const EMPTY: LyricsData = { plainLyrics: null, syncedLyrics: null, parsedSyncedLyrics: null, source: null, annotations: null, geniusUrl: null, songInfo: null };

export function useLyrics(currentSong: Song | null, era: Era | null) {
  // undefined = still searching, null = searched and not found
  const [results, setResults] = useState<{ lrclib: LyricsData | null | undefined; genius: GeniusInfo | null | undefined }>({ lrclib: undefined, genius: undefined });

  useEffect(() => {
    if (!currentSong) return;

    const cacheKey = `${currentSong.name}-${era?.name || ''}`;
    const cached = lyricsCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      return;
    }

    let isMounted = true;
    const alive = () => isMounted;
    setResults({ lrclib: undefined, genius: undefined });

    const initialArtist = parseArtistFromSong(currentSong.name, currentSong.extra, era?.name);

    let trackNamesToTry = getAlternativeNames(currentSong);
    let artistsToTry = [initialArtist];

    if (currentSong.name === "Alright but the beat is Father Stretch My Hands Pt. 1") {
      artistsToTry = ["Kendrick Lamar"];
      trackNamesToTry = ["Alright"];
    } else {
      // Fall back to the active tracker's primary artist (not a hardcoded one),
      // so songs credited to collaborators still resolve lyrics under the main artist.
      const primaryArtist = getArtistName(undefined);
      const lowerArtist = initialArtist.toLowerCase();
      const lowerPrimary = primaryArtist.toLowerCase();
      if (primaryArtist && !lowerArtist.includes(lowerPrimary)) {
        artistsToTry.push(primaryArtist);
        // Kanye is commonly credited as "Ye" on Genius — add the alias only for that tracker.
        if (lowerPrimary.includes('kanye')) artistsToTry.push('Ye');
      }
    }

    const lrclibP = fetchLrclib(artistsToTry, trackNamesToTry, alive).then(lrclib => {
      if (isMounted) setResults(r => ({ ...r, lrclib }));
      return lrclib;
    });
    const geniusP = fetchGeniusInfo(artistsToTry, trackNamesToTry, alive).then(genius => {
      if (isMounted) setResults(r => ({ ...r, genius }));
      return genius;
    });
    Promise.all([lrclibP, geniusP]).then(([lrclib, genius]) => {
      if (isMounted) lyricsCache.set(cacheKey, { lrclib, genius });
    });

    return () => {
      isMounted = false;
    };
  }, [currentSong, era]);

  const loading = results.lrclib === undefined;
  const error = results.lrclib === null ? "No lyrics found for this track." : null;

  return {
    ...(results.lrclib ?? EMPTY),
    // Genius info arrives on its own schedule and can exist even when lrclib has no lyrics.
    annotations: results.genius?.annotations ?? null,
    geniusUrl: results.genius?.geniusUrl ?? null,
    songInfo: results.genius?.songInfo ?? null,
    loading,
    error,
  };
}
