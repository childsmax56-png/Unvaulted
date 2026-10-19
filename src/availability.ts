import type { Era, Song } from './types';
import { isSongNotAvailable, looksLikeRealLink } from './utils';

// How much of a song is actually out there, collapsed into the four buckets the
// era timeline + tracklist filters use. Derived from the song row itself (not
// the sheet's free-text fileInfo, whose wording differs per tracker).
export type Availability = 'full' | 'partial' | 'snippet' | 'none';

export const AVAILABILITY_META: Record<Availability, { label: string; color: string }> = {
  full: { label: 'Full', color: '#F5A524' },
  partial: { label: 'Partial', color: '#E8D5A8' },
  snippet: { label: 'Snippet', color: '#6EA8FE' },
  none: { label: 'Not leaked', color: '#3A3A42' },
};

export const AVAILABILITY_ORDER: Availability[] = ['full', 'partial', 'snippet', 'none'];

export function songRawUrl(song: Song): string {
  return song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '') || '';
}

export function classifySong(song: Song): Availability {
  const rawUrl = songRawUrl(song);
  const lowerUrl = rawUrl.toLowerCase();
  if (isSongNotAvailable(song, rawUrl) || !looksLikeRealLink(rawUrl) || lowerUrl.includes('n/a')) return 'none';
  const len = (song.available_length || '').toLowerCase();
  if (len.includes('snippet')) return 'snippet';
  if (len.includes('partial') || len.includes('cut') || len.includes('tagged') || len.includes('beat only')) return 'partial';
  return 'full';
}

export type AvailabilityCounts = Record<Availability, number> & { total: number };

export function countAvailability(songs: Song[]): AvailabilityCounts {
  const counts: AvailabilityCounts = { full: 0, partial: 0, snippet: 0, none: 0, total: 0 };
  for (const s of songs) {
    counts[classifySong(s)]++;
    counts.total++;
  }
  return counts;
}

const eraCountsCache = new WeakMap<Era['data'], AvailabilityCounts>();

export function eraAvailability(era: Era): AvailabilityCounts {
  const data = era.data || {};
  const cached = eraCountsCache.get(data);
  if (cached) return cached;
  const counts = countAvailability(Object.values(data).flat());
  eraCountsCache.set(data, counts);
  return counts;
}

// "11/05/2011" | "??/??/2015" | "2018" → "2015"; null when no year is present.
export function yearOf(date: string | undefined): string | null {
  const m = (date || '').match(/(\d{4})/);
  return m ? m[1] : null;
}
