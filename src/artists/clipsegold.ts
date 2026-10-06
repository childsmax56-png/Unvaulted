import type { ArtistConfig } from './types';

// Clipse tracker. Data served from committed CSV snapshots under
// public/clipsegold/data/*.csv, transformed from the source Google-Sheet exports by
// scripts/build-bigupdate-csvs.py. An era only appears in the Music grid if its
// name is a key in ALBUM_RELEASE_DATES.
export const clipsegoldConfig: ArtistConfig = {
  slug: 'clipsegold',
  SITE_NAME: 'CLIPSEGOLD',
  SITE_DESCRIPTION: 'The Best Clipse Tracker In The World!',
  SITE_URL: 'https://unvaulted.cc/clipsegold/',
  OG_IMAGE_URL: '',
  STORAGE_PREFIX: 'clipsegold_',
  sheetCreator: 'iaon',

  HARDCODED_SHEET_ID: '1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ',
  HARDCODED_SHEET_GID: '',
  SHEET_URL_UNRELEASED: '',
  SHEET_URL_RECENT: '',

  accentColor: '#a3a3a3',
  artistLabel: 'Clipse',
  cardLetter: 'C',
  logoUrl: '',
  artistPhotoUrl: '/artists/clipsegold.jpg',

  getArtistName() {
    return 'Clipse';
  },

  CUSTOM_IMAGES: {},

  ALBUM_RELEASE_DATES: {
    'Exclusive Audio Footage': '??/??/????',
    'Lord Willin\'': '??/??/????',
    'Hell Hath No Fury': '??/??/????',
    'Til the Casket Drops': '??/??/????',
    'Fear Of God': '??/??/????',
    'Hear Ye Him': '??/??/????',
    'Fear Of God II: Let Us Pray': '??/??/????',
    'My Name Is My Name': '??/??/????',
    'Wrath of Caine': '??/??/????',
    'King Push – Darkest Before Dawn: The Prelude': '??/??/????',
    'Let the Dead Bury the Dead': '??/??/????',
    'DAYTONA': '??/??/????',
    'It\'s Almost Dry': '??/??/????',
    'Let God Sort \'Em Out': '??/??/????',
    'PT5': '??/??/????',
    'M3': '??/??/????',
    'C5': '??/??/????'
  },

  HIDDEN_ALBUMS: [],
  ALBUM_DESCRIPTIONS: {},
  ALBUM_SONG_COUNTS: {},
  CUSTOM_ALBUM_INFO: {},
  ERA_MAPPINGS: {},

  ALBUM_ORDER: [
    'Exclusive Audio Footage',
    'Lord Willin\'',
    'Hell Hath No Fury',
    'Til the Casket Drops',
    'Fear Of God',
    'Hear Ye Him',
    'Fear Of God II: Let Us Pray',
    'My Name Is My Name',
    'Wrath of Caine',
    'King Push – Darkest Before Dawn: The Prelude',
    'Let the Dead Bury the Dead',
    'DAYTONA',
    'It\'s Almost Dry',
    'Let God Sort \'Em Out',
    'PT5',
    'M3',
    'C5'
  ],

  TAG_MAP: {},
  TAG_TOOLTIP_MAP: {},
  ERA_THEMES: {},
  hasSubAlbumsTab: false, // no sub-albums data for this tracker
};
