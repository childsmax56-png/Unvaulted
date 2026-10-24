import type { ArtistConfig } from './types';
import { yelolgoldConfig } from './yelolgold';

// Fourth Ye tracker variant ("yetracker.com"), built from its own Google Sheet
// by scripts/build-yecomgold-csvs.py. The sheet is a fork of the same template
// as yelolgold's — identical tabs, gids and era names — so it inherits
// yelolgold's era covers/dates/descriptions and only overrides identity.
// Data served live via SHEET_SOURCES (Sheets API, downloads are disabled) with
// committed CSV snapshots under public/yecomgold/data/*.csv as the fallback.
const SHEET_ID = '1JcJOHsNdCo7rBS6dbOUbBGjeq_CS8x0FqdW9_cnTozs';

export const yecomgoldConfig: ArtistConfig = {
  ...yelolgoldConfig,
  slug: 'yecomgold',
  // Off the landing grid/search — reachable via yegold's alt-tracker picker
  // or directly at /yecomgold/.
  hidden: true,
  SITE_NAME: 'YE (yetracker.com)',
  SITE_DESCRIPTION: 'The Kanye West tracker, alternate yetracker.com version',
  SITE_URL: 'https://unvaulted.cc/yecomgold/',
  STORAGE_PREFIX: 'yecomgold_',

  HARDCODED_SHEET_ID: SHEET_ID,
  HARDCODED_SHEET_GID: '199908479',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=689133373`,

  alternateTrackers: [
    { slug: 'yegold', label: 'Official' },
    { slug: 'yzygold', label: 'Suzy' },
    { slug: 'yelolgold', label: 'Lol' },
  ],

  artistLabel: 'Ye (yetracker.com)',
  cardLetter: 'COM',
};
