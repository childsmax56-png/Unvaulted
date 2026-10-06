import type { ArtistConfig } from './types';

// Dua Lipa tracker. Data served from committed CSV snapshots under
// public/dualipagold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const dualipagoldConfig: ArtistConfig = {
  slug: 'dualipagold',
  SITE_NAME: 'DUALIPAGOLD',
  SITE_DESCRIPTION: 'The Best Dua Lipa Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/dualipagold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'dualipagold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1gi_foSEziQ48hTlq8hBqIwZCHz6hma1rYXr8qykBq6c',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#db2777',
  artistLabel: 'Dua Lipa',
  cardLetter: 'D',
  logoUrl: '',
  artistPhotoUrl: '/artists/dualipagold.jpg',

  getArtistName() {
    return 'Dua Lipa';
  },

  CUSTOM_IMAGES: {
    'Early Career': '/dualipagold/eras/early-career.jpg',
    'Dua Lipa': '/dualipagold/eras/dua-lipa.png',
    'Future Nostalgia': '/dualipagold/eras/future-nostalgia.png',
    'Radical Optimism': '/dualipagold/eras/radical-optimism.png',
  },

  ALBUM_RELEASE_DATES: {
    'Early Career': '??/??/????',
    'Dua Lipa': '??/??/????',
    'Future Nostalgia': '??/??/????',
    'Radical Optimism': '??/??/????',
    'DL4': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Early Career',
    'Dua Lipa',
    'Future Nostalgia',
    'Radical Optimism',
    'DL4'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
