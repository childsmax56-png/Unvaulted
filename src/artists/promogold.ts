import type { ArtistConfig } from './types';
import { yegoldConfig } from './yegold';

// "Unvaulted Promotional" Kanye tracker — an EASTER EGG.
//
// Hidden from the landing grid and only surfaced when the landing search query
// contains "unvaulted promo" (see `searchAliases` + matchesQuery in LandingPage.tsx).
// The sheet is a copy of yegold's template (same gids/era names), so it inherits
// yegold's era covers/dates and only exposes the Unreleased (Music) and Recent tabs.
// Data served live via SHEET_SOURCES with committed CSV snapshots under
// public/promogold/data/*.csv (scripts/build-promogold-csvs.py) as the fallback.
const SHEET_ID = '1zKk5p9lDA40p0EXrvtfNTyUzUTVUW1kCpqy7BF0WyWo';

export const promogoldConfig: ArtistConfig = {
  ...yegoldConfig,
  slug: 'promogold',
  hidden: true,
  searchAliases: ['unvaulted promo'],
  SITE_NAME: 'Unvaulted Promotional Kanye Tracker',
  SITE_DESCRIPTION: 'The Unvaulted promotional Kanye West tracker',
  SITE_URL: 'https://unvaulted.cc/promogold/',
  STORAGE_PREFIX: 'promogold_',

  HARDCODED_SHEET_ID: SHEET_ID,
  HARDCODED_SHEET_GID: '77894385',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=77894385`,

  // Only Music (Unreleased) + Recent.
  alternateTrackers: [],
  HIDDEN_ALBUMS: [],
  hasReleasedTab: false,
  hasArtTab: false,
  hasStemsTab: false,
  hasMiscTab: false,
  hasVideosTab: false,
  hasTracklistsTab: false,
  hasCompsTab: false,
  hasSubAlbumsTab: false,
  hasAlbumCopiesTab: false,
  hasGroupbuysTab: false,

  artistLabel: 'Ye (Unvaulted Promo)',
  cardLetter: 'PRO',
};
