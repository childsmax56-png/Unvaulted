import type { ArtistConfig } from './types';

// De La Soul tracker. Data served from committed CSV snapshots under
// public/delasoulgold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const delasoulgoldConfig: ArtistConfig = {
  slug: 'delasoulgold',
  SITE_NAME: 'DELASOULGOLD',
  SITE_DESCRIPTION: 'The Best De La Soul Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/delasoulgold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'delasoulgold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '19KA4hq1j8sVhTEt4gqWWn6Potw9N_IGGJ2bwgZeVYHI',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#facc15',
  artistLabel: 'De La Soul',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/delasoulgold.jpg',

  getArtistName() {
    return 'De La Soul';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    '3 FEET HIGH AND RISING': '??/??/????',
    'De La Soul... is dead': '??/??/????',
    'Buhloone Mindstate': '??/??/????',
    'Stakes is High': '??/??/????',
    'AOI: Mosaic Thump': '??/??/????',
    'AOI: Bionix': '??/??/????',
    'AOI: 3 [V1]': '??/??/????',
    'THE GRIND DATE': '??/??/????',
    'You\'re Welcome!': '??/??/????',
    'Are You In?': '??/??/????',
    'And the Anonymous Nobody...': '??/??/????',
    'Cabin In The Sky': '??/??/????',
    'AOI: 3 [V2]': '??/??/????',
    '4 Exits Only': '??/??/????',
    'Unknown': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    '3 FEET HIGH AND RISING',
    'De La Soul... is dead',
    'Buhloone Mindstate',
    'Stakes is High',
    'AOI: Mosaic Thump',
    'AOI: Bionix',
    'AOI: 3 [V1]',
    'THE GRIND DATE',
    'You\'re Welcome!',
    'Are You In?',
    'And the Anonymous Nobody...',
    'Cabin In The Sky',
    'AOI: 3 [V2]',
    '4 Exits Only',
    'Unknown'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
